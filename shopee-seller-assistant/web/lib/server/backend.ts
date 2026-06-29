import axios, { type AxiosInstance } from "axios";

// Server-side integration with the existing REST API. The single-user MVP has
// no login UI, so this module transparently provisions one user + one seller at
// server boot and attaches the bearer token to every upstream call. The browser
// talks only to this app's /api/* route handlers and never handles a token.

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const STORE_NAME = process.env.STORE_NAME ?? "Toko Saya";
const SELLER_TIER = process.env.SELLER_TIER ?? "REGULAR";

export interface BackendContext {
  http: AxiosInstance;
  sellerId: string;
}

let contextPromise: Promise<BackendContext> | null = null;

async function bootstrap(): Promise<BackendContext> {
  const base = axios.create({ baseURL: BACKEND_URL, timeout: 10_000 });

  // Provision a fresh single-user account for this server instance.
  const email = `mvp-${Date.now()}-${Math.floor(Math.random() * 1e6)}@local.app`;
  const reg = await base.post("/api/auth/register", { email });
  const token: string = reg.data.data.token;

  const http = axios.create({
    baseURL: BACKEND_URL,
    timeout: 10_000,
    headers: { Authorization: `Bearer ${token}` },
  });

  const seller = await http.post("/api/sellers", {
    storeName: STORE_NAME,
    marketplace: "SHOPEE",
    sellerTier: SELLER_TIER,
  });
  const sellerId: string = seller.data.data.id;

  return { http, sellerId };
}

/** Lazily bootstrap once per server process and reuse. */
export function getBackend(): Promise<BackendContext> {
  if (contextPromise === null) {
    contextPromise = bootstrap().catch((e) => {
      contextPromise = null; // allow retry on next request if bootstrap failed
      throw e;
    });
  }
  return contextPromise;
}
