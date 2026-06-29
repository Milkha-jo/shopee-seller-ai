import { z } from "zod";
import type {
  BreakEvenRequestInput,
  NewFeeProfileVersionInput,
  ProfitRequestInput,
  RecommendationMode,
  RecommendRequestInput,
} from "@/types/api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const moneyField = z
  .string()
  .trim()
  .refine((v) => v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0, {
    message: "Enter a non-negative amount",
  });
const optionalMoneyField = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), {
    message: "Enter a non-negative amount or leave blank",
  });

// ---- Calculator ----

export const calculatorSchema = z.object({
  productCost: moneyField,
  shippingCost: moneyField,
  packagingCost: moneyField,
  otherCost: moneyField,
  sellingPrice: moneyField.refine((v) => Number(v) > 0, {
    message: "Selling price must be greater than 0",
  }),
  discountType: z.enum(["NONE", "PERCENTAGE", "FLAT"]),
  discountValue: z.string().trim(),
  asOfDate: z.string().regex(DATE_RE, "Use YYYY-MM-DD"),
});

export type CalculatorValues = z.infer<typeof calculatorSchema>;

/**
 * Map the four UI cost lines onto the backend's two-field cost model
 * (productCost + packagingCost). This is request preparation — a sum of the
 * user's own inputs — not a profit/fee calculation, which stays on the backend.
 */
export function deriveCostInputs(v: CalculatorValues): {
  productCost: string;
  packagingCost: string;
} {
  const productSide =
    Number(v.productCost) + Number(v.shippingCost) + Number(v.otherCost);
  return { productCost: String(productSide), packagingCost: v.packagingCost };
}

/** Map the discount form fields onto the backend discount shape. Percent values
 *  are converted to a decimal rate (÷100); no fee/profit math is done here. */
export function deriveDiscount(
  v: CalculatorValues,
): ProfitRequestInput["discount"] {
  if (v.discountType === "PERCENTAGE") {
    return { type: "PERCENTAGE", value: String(Number(v.discountValue || "0") / 100) };
  }
  if (v.discountType === "FLAT") {
    return { type: "FLAT", value: String(Number(v.discountValue || "0")) };
  }
  return { type: "NONE", value: null };
}

export function toProfitRequest(v: CalculatorValues): ProfitRequestInput {
  return {
    asOfDate: v.asOfDate,
    sellingPrice: v.sellingPrice,
    costInputs: deriveCostInputs(v),
    discount: deriveDiscount(v),
  };
}

/** Break-even shares the calculator's cost inputs and date; no selling price. */
export function toBreakEvenRequest(v: CalculatorValues): BreakEvenRequestInput {
  return { asOfDate: v.asOfDate, costInputs: deriveCostInputs(v) };
}

/**
 * Build a recommendation request from the calculator's costs/date/discount plus
 * a mode and its single target value. Percent-style targets (margin, markup,
 * safety buffer) are converted to decimal rates; the profit target is rupiah.
 * The backend solves and round-trips — the frontend computes nothing.
 */
export function toRecommendRequest(
  v: CalculatorValues,
  mode: RecommendationMode,
  target: string,
): RecommendRequestInput {
  const req: RecommendRequestInput = {
    asOfDate: v.asOfDate,
    mode,
    costInputs: deriveCostInputs(v),
    discount: deriveDiscount(v),
  };
  const n = Number(target || "0");
  if (mode === "TARGET_PROFIT") req.targetProfit = String(n);
  else if (mode === "TARGET_MARGIN") req.targetMargin = String(n / 100);
  else if (mode === "TARGET_MARKUP") req.targetMarkup = String(n / 100);
  else if (mode === "MIN_VIABLE" && target.trim() !== "")
    req.safetyBuffer = String(n / 100);
  return req;
}

// ---- Fee Profile ----

const ruleSchema = z.object({
  feeType: z.enum(["ADMIN", "SERVICE", "PAYMENT"]),
  rate: z
    .string()
    .trim()
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1, {
      message: "Rate must be a decimal between 0 and 1 (e.g. 0.02)",
    }),
  cap: optionalMoneyField,
});

export const feeProfileSchema = z.object({
  effectiveDate: z.string().regex(DATE_RE, "Use YYYY-MM-DD"),
  endDate: z
    .string()
    .trim()
    .refine((v) => v === "" || DATE_RE.test(v), { message: "Use YYYY-MM-DD or leave blank" }),
  sourceReference: z.string().trim().min(1, "Required"),
  rules: z.array(ruleSchema).length(3, "Provide ADMIN, SERVICE and PAYMENT rules"),
});

export type FeeProfileValues = z.infer<typeof feeProfileSchema>;

export function toFeeProfileRequest(v: FeeProfileValues): NewFeeProfileVersionInput {
  return {
    effectiveDate: v.effectiveDate,
    endDate: v.endDate === "" ? null : v.endDate,
    sourceReference: v.sourceReference,
    rules: v.rules.map((r) => ({
      feeType: r.feeType,
      rate: r.rate,
      cap: r.cap === "" ? null : r.cap,
    })),
  };
}

export const DEFAULT_FEE_PROFILE: FeeProfileValues = {
  effectiveDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  sourceReference: "shopee-id",
  rules: [
    { feeType: "ADMIN", rate: "0.02", cap: "10000" },
    { feeType: "SERVICE", rate: "0.04", cap: "" },
    { feeType: "PAYMENT", rate: "0.02", cap: "" },
  ],
};
