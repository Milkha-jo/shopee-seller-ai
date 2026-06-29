import type { NextRequest } from "next/server";
import { getBackend } from "@/lib/server/backend";
import { forward } from "@/lib/server/forward";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { http, sellerId } = await getBackend();
  const body = await req.json();
  return forward(() =>
    http.put(`/api/fee-profiles/${params.id}`, { ...body, sellerProfileId: sellerId }),
  );
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { http } = await getBackend();
  return forward(() => http.delete(`/api/fee-profiles/${params.id}`));
}
