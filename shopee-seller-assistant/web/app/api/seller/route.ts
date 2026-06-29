import { getBackend } from "@/lib/server/backend";
import { forward } from "@/lib/server/forward";

export const dynamic = "force-dynamic";

export async function GET() {
  const { http, sellerId } = await getBackend();
  return forward(() => http.get(`/api/sellers/${sellerId}`));
}
