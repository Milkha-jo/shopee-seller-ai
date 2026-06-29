import type { NextRequest } from "next/server";
import { handle, data, take } from "@/lib/server/http";
import { getServices, getSellerId } from "@/lib/server/runtime";
import { parseProfitBody } from "@apihttp/validate";
import { presentProfit } from "@apihttp/present";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const sellerProfileId = await getSellerId();
    const body = parseProfitBody({ ...(await req.json()), sellerProfileId });
    const result = take(await getServices().calculation.calculateProfit(body));
    return data(presentProfit(result), 200);
  });
}
