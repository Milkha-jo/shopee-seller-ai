import { handle, data, take } from "@/lib/server/http";
import { getServices, getSellerId } from "@/lib/server/runtime";
import { presentSeller } from "@apihttp/present";
import { notFound } from "@apihttp/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return handle(async () => {
    const id = await getSellerId();
    const seller = take(await getServices().sellers.getById(id));
    if (seller === null) throw notFound("seller profile not found");
    return data(presentSeller(seller), 200);
  });
}
