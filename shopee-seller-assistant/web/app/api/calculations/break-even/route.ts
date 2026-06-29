import type { NextRequest } from "next/server";
import { handle, data, take } from "@/lib/server/http";
import { getServices, getSellerId } from "@/lib/server/runtime";
import { parseBreakEvenBody } from "@apihttp/validate";
import { presentBreakEven } from "@apihttp/present";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const sellerProfileId = await getSellerId();
    const body = parseBreakEvenBody({ ...(await req.json()), sellerProfileId });
    const result = take(await getServices().pricing.calculateBreakEven(body));
    return data(presentBreakEven(result), 200);
  });
}
