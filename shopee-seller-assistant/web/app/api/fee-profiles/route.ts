import type { NextRequest } from "next/server";
import { handle, data, take } from "@/lib/server/http";
import { getServices, getSellerId } from "@/lib/server/runtime";
import { parseVersionBody } from "@apihttp/validate";
import { presentVersion } from "@apihttp/present";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const id = await getSellerId();
    const version = parseVersionBody(await req.json(), id);
    const created = take(await getServices().feeProfile.createVersion(version));
    return data(presentVersion(created), 201);
  });
}
