import { NextResponse } from "next/server";
import { AxiosError, type AxiosResponse } from "axios";

/**
 * Run an upstream backend call and mirror its status + JSON body to the client.
 * Backend error envelopes ({ error: { code, message } }) and HTTP status are
 * preserved; transport failures surface as 502.
 */
export async function forward(
  call: () => Promise<AxiosResponse>,
): Promise<NextResponse> {
  try {
    const res = await call();
    return NextResponse.json(res.data, { status: res.status });
  } catch (e) {
    if (e instanceof AxiosError && e.response) {
      return NextResponse.json(e.response.data, { status: e.response.status });
    }
    return NextResponse.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "backend unavailable" } },
      { status: 502 },
    );
  }
}
