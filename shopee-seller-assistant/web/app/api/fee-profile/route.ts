import type { NextRequest } from "next/server";
import { getBackend } from "@/lib/server/backend";
import { forward } from "@/lib/server/forward";
import { todayIso } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { http, sellerId } = await getBackend();
  const asOf = req.nextUrl.searchParams.get("asOf") ?? todayIso();
  return forward(() =>
    http.get(`/api/sellers/${sellerId}/fee-profile`, { params: { asOf } }),
  );
}
