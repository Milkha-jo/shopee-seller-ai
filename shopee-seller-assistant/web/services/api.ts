import axios, { AxiosError } from "axios";
import type {
  ApiErrorBody,
  BreakEvenRequestInput,
  BreakEvenResult,
  FeeProfileVersion,
  NewFeeProfileVersionInput,
  ProfitRequestInput,
  ProfitResult,
  RecommendRequestInput,
  RecommendResult,
  Seller,
} from "@/types/api";

// Same-origin client → this app's BFF route handlers. The browser never sends
// auth or seller ids; the server injects them.
const client = axios.create({ baseURL: "/api", timeout: 15_000 });

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toApiError(e: unknown): ApiError {
  if (e instanceof AxiosError && e.response) {
    const body = e.response.data as { error?: ApiErrorBody } | undefined;
    const err = body?.error;
    return new ApiError(
      e.response.status,
      err?.code ?? "ERROR",
      err?.message ?? "Request failed",
      err?.details,
    );
  }
  return new ApiError(0, "NETWORK", "Network error");
}

async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  try {
    const res = await p;
    return res.data.data;
  } catch (e) {
    throw toApiError(e);
  }
}

export const api = {
  getSeller: (): Promise<Seller> => unwrap<Seller>(client.get("/seller")),

  getActiveFeeProfile: (asOf: string): Promise<FeeProfileVersion> =>
    unwrap<FeeProfileVersion>(client.get("/fee-profile", { params: { asOf } })),

  createFeeProfile: (input: NewFeeProfileVersionInput): Promise<FeeProfileVersion> =>
    unwrap<FeeProfileVersion>(client.post("/fee-profiles", input)),

  replaceFeeProfile: (
    id: string,
    input: NewFeeProfileVersionInput,
  ): Promise<FeeProfileVersion> =>
    unwrap<FeeProfileVersion>(client.put(`/fee-profiles/${id}`, input)),

  deactivateFeeProfile: (id: string): Promise<{ deactivated: boolean }> =>
    unwrap<{ deactivated: boolean }>(client.delete(`/fee-profiles/${id}`)),

  calculateProfit: (input: ProfitRequestInput): Promise<ProfitResult> =>
    unwrap<ProfitResult>(client.post("/calculations/profit", input)),

  calculateBreakEven: (input: BreakEvenRequestInput): Promise<BreakEvenResult> =>
    unwrap<BreakEvenResult>(client.post("/calculations/break-even", input)),

  recommend: (input: RecommendRequestInput): Promise<RecommendResult> =>
    unwrap<RecommendResult>(client.post("/calculations/recommend", input)),
};
