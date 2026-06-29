import type { NextRequest } from "next/server";
import { getBackend } from "@/lib/server/backend";
import { forward } from "@/lib/server/forward";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { http, sellerId } = await getBackend();
  const body = await req.json();
  return forward(() =>
    http.post(`/api/calculations/recommend`, {
      ...body,
      sellerProfileId: sellerId,
    }),
  );
}
