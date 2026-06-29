import { createPool, type Pool } from "@repo/db/pool";
import { makeServices, type Services } from "@svc/wiring";
import { SellerProfileService } from "@svc/SellerProfileService";
import { PricingService } from "@svc/PricingService";
import { AuthService } from "@svc/AuthService";
import { UserRepository } from "@repo/repositories/UserRepository";
import { SellerProfileRepository } from "@repo/repositories/SellerProfileRepository";
import { FeeProfileRepository } from "@repo/repositories/FeeProfileRepository";
import { FeeRuleRepository } from "@repo/repositories/FeeRuleRepository";
import { isErr } from "@core/errors";
import type { SellerTier } from "@core/types";

// Direct, in-process wiring of the service layer for serverless (Vercel).
// There is no separate API server: the Next.js route handlers call these
// services directly over a single pooled connection to Postgres (Neon).
//
// Single-user MVP: instead of provisioning a user/seller per server boot (which
// has no meaning in serverless), exactly one seller is seeded in the database
// and reused. The seller id is discovered from the DB and cached.

const STORE_NAME = process.env.STORE_NAME ?? "Toko Saya";
const SELLER_TIER = (process.env.SELLER_TIER ?? "REGULAR") as SellerTier;
const SEED_EMAIL = process.env.SEED_EMAIL ?? "owner@local.app";

interface Runtime {
  pool: Pool;
  services: Services & {
    sellers: SellerProfileService;
    pricing: PricingService;
  };
  auth: AuthService;
  sellerId: string | null;
}

// Cache on globalThis so warm serverless invocations (and dev HMR) reuse one
// pool and one resolved seller id rather than opening a pool per request.
const globalForRuntime = globalThis as unknown as { __shopeeRuntime?: Runtime };

function build(): Runtime {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = createPool(url);
  const base = makeServices(pool);
  const services = {
    ...base,
    sellers: new SellerProfileService({ sellers: new SellerProfileRepository(pool) }),
    pricing: new PricingService({
      sellerProfiles: new SellerProfileRepository(pool),
      feeProfiles: new FeeProfileRepository(pool),
      feeRules: new FeeRuleRepository(pool),
    }),
  };
  const auth = new AuthService({ users: new UserRepository(pool) });
  return { pool, services, auth, sellerId: null };
}

function runtime(): Runtime {
  return (globalForRuntime.__shopeeRuntime ??= build());
}

export function getServices(): Runtime["services"] {
  return runtime().services;
}

async function firstSellerId(pool: Pool): Promise<string | null> {
  const res = await pool.query<{ id: string }>(
    "SELECT id FROM seller_profiles ORDER BY created_at ASC LIMIT 1",
  );
  return res.rows[0]?.id ?? null;
}

/**
 * Resolve the single seller, seeding one (user + seller) on first use if the
 * database is empty. Idempotent in the common case; tolerant of a concurrent
 * cold-start race by re-selecting if the seed insert loses.
 */
export async function getSellerId(): Promise<string> {
  const r = runtime();
  if (r.sellerId) return r.sellerId;

  const existing = await firstSellerId(r.pool);
  if (existing) return (r.sellerId = existing);

  const userRes = await r.auth.register(SEED_EMAIL);
  if (isErr(userRes)) {
    const again = await firstSellerId(r.pool);
    if (again) return (r.sellerId = again);
    throw new Error(`seed failed: ${JSON.stringify(userRes.error)}`);
  }

  const sellerRes = await r.services.sellers.create({
    userId: userRes.value.id,
    storeName: STORE_NAME,
    marketplace: "SHOPEE",
    sellerTier: SELLER_TIER,
  });
  if (isErr(sellerRes)) {
    const again = await firstSellerId(r.pool);
    if (again) return (r.sellerId = again);
    throw new Error(`seed seller failed: ${JSON.stringify(sellerRes.error)}`);
  }
  return (r.sellerId = sellerRes.value.id);
}
