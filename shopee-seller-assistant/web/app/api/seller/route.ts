import type { NextRequest } from "next/server";
import { handle, data, take } from "@/lib/server/http";
import { getServices, getSellerId, updateStoreName } from "@/lib/server/runtime";
import { presentSeller } from "@apihttp/present";
import { notFound, badRequest } from "@apihttp/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handle(async () => {
    const id = await getSellerId();
    const seller = take(await getServices().sellers.getById(id));
    if (seller === null) throw notFound("seller profile not found");
    return data(presentSeller(seller), 200);
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const body = (await req.json()) as { storeName?: unknown };
    const name = typeof body?.storeName === "string" ? body.storeName.trim() : "";
    if (!name) throw badRequest("VALIDATION_ERROR", "storeName is required");
    if (name.length > 100) throw badRequest("VALIDATION_ERROR", "storeName too long");
    const seller = await updateStoreName(name);
    return data(presentSeller(seller), 200);
  });
}
