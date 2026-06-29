import { describe, it, expect } from "vitest";
import {
  calculatorSchema,
  feeProfileSchema,
  toProfitRequest,
  toBreakEvenRequest,
  toRecommendRequest,
  toFeeProfileRequest,
  DEFAULT_FEE_PROFILE,
  type CalculatorValues,
} from "@/types/schemas";

const baseCalc: CalculatorValues = {
  productCost: "45000",
  shippingCost: "2000",
  packagingCost: "3000",
  otherCost: "1000",
  sellingPrice: "100000",
  discountType: "NONE",
  discountValue: "",
  asOfDate: "2026-06-28",
};

describe("toProfitRequest", () => {
  it("aggregates product+shipping+other into backend productCost, keeps packaging", () => {
    const r = toProfitRequest(baseCalc);
    expect(r.costInputs.productCost).toBe("48000"); // 45000+2000+1000
    expect(r.costInputs.packagingCost).toBe("3000");
    expect(r.discount).toEqual({ type: "NONE", value: null });
  });
  it("converts percentage discount to decimal rate", () => {
    const r = toProfitRequest({ ...baseCalc, discountType: "PERCENTAGE", discountValue: "10" });
    expect(r.discount).toEqual({ type: "PERCENTAGE", value: "0.1" });
  });
  it("passes flat discount through as money", () => {
    const r = toProfitRequest({ ...baseCalc, discountType: "FLAT", discountValue: "5000" });
    expect(r.discount).toEqual({ type: "FLAT", value: "5000" });
  });
});

describe("toBreakEvenRequest", () => {
  it("reuses the aggregated cost model and date, no selling price", () => {
    const r = toBreakEvenRequest(baseCalc);
    expect(r.costInputs).toEqual({ productCost: "48000", packagingCost: "3000" });
    expect(r.asOfDate).toBe("2026-06-28");
    expect("sellingPrice" in r).toBe(false);
  });
});

describe("toRecommendRequest", () => {
  it("TARGET_PROFIT carries rupiah target and the discount", () => {
    const r = toRecommendRequest(
      { ...baseCalc, discountType: "PERCENTAGE", discountValue: "10" },
      "TARGET_PROFIT",
      "20000",
    );
    expect(r.mode).toBe("TARGET_PROFIT");
    expect(r.targetProfit).toBe("20000");
    expect(r.targetMargin).toBeUndefined();
    expect(r.costInputs.productCost).toBe("48000");
    expect(r.discount).toEqual({ type: "PERCENTAGE", value: "0.1" });
  });
  it("TARGET_MARGIN converts percent to decimal rate", () => {
    const r = toRecommendRequest(baseCalc, "TARGET_MARGIN", "25");
    expect(r.targetMargin).toBe("0.25");
    expect(r.targetProfit).toBeUndefined();
  });
  it("TARGET_MARKUP converts percent to decimal rate", () => {
    const r = toRecommendRequest(baseCalc, "TARGET_MARKUP", "40");
    expect(r.targetMarkup).toBe("0.4");
  });
  it("MIN_VIABLE omits safetyBuffer when target is blank", () => {
    const r = toRecommendRequest(baseCalc, "MIN_VIABLE", "");
    expect(r.safetyBuffer).toBeUndefined();
    expect(r.mode).toBe("MIN_VIABLE");
  });
  it("MIN_VIABLE converts a buffer percent when provided", () => {
    const r = toRecommendRequest(baseCalc, "MIN_VIABLE", "10");
    expect(r.safetyBuffer).toBe("0.1");
  });
});

describe("calculatorSchema", () => {
  it("accepts valid input", () => {
    expect(calculatorSchema.safeParse(baseCalc).success).toBe(true);
  });
  it("rejects zero selling price", () => {
    expect(calculatorSchema.safeParse({ ...baseCalc, sellingPrice: "0" }).success).toBe(false);
  });
  it("rejects negative cost", () => {
    expect(calculatorSchema.safeParse({ ...baseCalc, productCost: "-1" }).success).toBe(false);
  });
});

describe("feeProfileSchema / toFeeProfileRequest", () => {
  it("validates the default profile", () => {
    expect(feeProfileSchema.safeParse(DEFAULT_FEE_PROFILE).success).toBe(true);
  });
  it("rejects rate above 1", () => {
    const bad = {
      ...DEFAULT_FEE_PROFILE,
      rules: DEFAULT_FEE_PROFILE.rules.map((r, i) => (i === 0 ? { ...r, rate: "1.5" } : r)),
    };
    expect(feeProfileSchema.safeParse(bad).success).toBe(false);
  });
  it("maps empty cap to null", () => {
    const out = toFeeProfileRequest(DEFAULT_FEE_PROFILE);
    expect(out.rules[1]?.cap).toBeNull(); // SERVICE has empty cap
    expect(out.rules[0]?.cap).toBe("10000");
    expect(out.endDate).toBeNull();
  });
});
