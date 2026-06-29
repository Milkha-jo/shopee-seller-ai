import type { NextRequest } from "next/server";
import { handle, data, take } from "@/lib/server/http";
import { getServices, getSellerId } from "@/lib/server/runtime";
import { parseVersionBody } from "@apihttp/validate";
import { presentVersion } from "@apihttp/present";
import { notFound } from "@apihttp/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const sellerId = await getSellerId();
    const version = parseVersionBody(await req.json(), sellerId);
    const updated = take(await getServices().feeProfile.replaceVersion(params.id, version));
    return data(presentVersion(updated), 200);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const removed = take(await getServices().feeProfile.deactivateVersion(params.id));
    if (!removed) throw notFound("fee profile not found");
    return data({ deactivated: true }, 200);
  });
}
