import type { NextRequest } from "next/server";
import { handle, data } from "@/lib/server/http";
import { deletePromo } from "@/lib/server/runtime";
import { notFound } from "@apihttp/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ok = await deletePromo(params.id);
    if (!ok) throw notFound("promo not found");
    return data({ deleted: true }, 200);
  });
}
