import type { NextRequest } from "next/server";
import { handle, data } from "@/lib/server/http";
import { listPromos, createPromo, type BuyerDiscountType } from "@/lib/server/runtime";
import { badRequest } from "@apihttp/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DISCOUNT_TYPES: BuyerDiscountType[] = ["NONE", "PERCENTAGE", "FLAT"];

export async function GET() {
  return handle(async () => data(await listPromos(), 200));
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) throw badRequest("VALIDATION_ERROR", "name is required");
    const type = (typeof b.buyerDiscountType === "string" ? b.buyerDiscountType : "NONE") as BuyerDiscountType;
    if (!DISCOUNT_TYPES.includes(type)) throw badRequest("VALIDATION_ERROR", "invalid buyerDiscountType");
    const sellerCost = Number(b.sellerCost ?? 0);
    if (!Number.isFinite(sellerCost) || sellerCost < 0) throw badRequest("VALIDATION_ERROR", "invalid sellerCost");

    const created = await createPromo({
      name,
      sellerCost,
      buyerDiscountType: type,
      buyerDiscountValue:
        type === "NONE" ? null : b.buyerDiscountValue != null ? String(b.buyerDiscountValue) : null,
      startDate: b.startDate ? String(b.startDate) : null,
      endDate: b.endDate ? String(b.endDate) : null,
      notes: b.notes ? String(b.notes) : null,
    });
    return data(created, 201);
  });
}
