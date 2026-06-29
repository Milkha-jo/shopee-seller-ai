import type { NextRequest } from "next/server";
import { handle, data, take } from "@/lib/server/http";
import { getServices, getSellerId } from "@/lib/server/runtime";
import { parseRecommendBody } from "@apihttp/validate";
import { presentRecommend } from "@apihttp/present";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const sellerProfileId = await getSellerId();
    const body = parseRecommendBody({ ...(await req.json()), sellerProfileId });
    const result = take(await getServices().pricing.recommend(body));
    return data(presentRecommend(result), 200);
  });
}
