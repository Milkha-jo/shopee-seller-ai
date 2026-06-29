import type { NextRequest } from "next/server";
import { handle, data, take } from "@/lib/server/http";
import { getServices, getSellerId } from "@/lib/server/runtime";
import { parseAsOfDate } from "@apihttp/validate";
import { presentVersion } from "@apihttp/present";
import { notFound } from "@apihttp/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const asOf = parseAsOfDate(req.nextUrl.searchParams.get("asOf") ?? undefined);
    const id = await getSellerId();
    const version = take(await getServices().feeProfile.getActiveProfile(id, asOf));
    if (version === null) throw notFound("no active fee profile");
    return data(presentVersion(version), 200);
  });
}
