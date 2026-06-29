import { describe, it, expect } from "vitest";
import { buildSweepRequests } from "@/hooks/useProfit";
import type { ProfitRequestInput } from "@/types/api";

const base: ProfitRequestInput = {
  asOfDate: "2026-06-28",
  sellingPrice: "100000",
  costInputs: { productCost: "48000", packagingCost: "3000" },
  discount: { type: "NONE", value: null },
};

describe("buildSweepRequests", () => {
  it("creates N requests spanning 0.5x..1.5x of base price", () => {
    const reqs = buildSweepRequests(base, 9);
    expect(reqs).toHaveLength(9);
    expect(reqs[0]?.price).toBe(50000);
    expect(reqs[8]?.price).toBe(150000);
    expect(reqs[4]?.price).toBe(100000);
    expect(reqs[0]?.request.sellingPrice).toBe("50000");
  });
  it("returns empty for invalid base price", () => {
    expect(buildSweepRequests({ ...base, sellingPrice: "0" })).toEqual([]);
    expect(buildSweepRequests({ ...base, sellingPrice: "x" })).toEqual([]);
  });
});
