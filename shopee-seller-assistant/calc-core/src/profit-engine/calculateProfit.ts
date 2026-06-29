import {
  type FeeLine,
  type ProfitInputs,
  Money,
  Rate,
  ResultStatus,
} from '../types';
import { type CalcError, type Result, err, isErr, ok } from '../errors';
import { validateProfitInputs } from '../validation';
import { calculateDiscount } from '../discount';
import { calculateFees } from '../fees/calculator';

/**
 * Profit Engine (Phase 1 — Step 6).
 *
 * Orchestrates: validate inputs → totalCost → discount → fees → net profit →
 * margin / markup. The fee profile is supplied already resolved (in
 * `ProfitInputs.profile`); resolution happens upstream.
 *
 * Returns `ProfitCalculation`, which is `ProfitResult` MINUS `breakEvenPrice`.
 * Break-even is a separate concern (Step 7) and is composed into the full
 * `ProfitResult` later; the profit engine does not depend on it.
 *
 * Margin / markup are full-precision fractions (rounding to a display % is a
 * UI concern). An undefined metric is reported via `status`, with the
 * corresponding field absent — never a thrown error.
 */

export interface ProfitCalculation {
  readonly effectivePrice: Money;
  readonly feeLines: readonly FeeLine[];
  readonly totalFees: Money;
  readonly netRevenue: Money;
  readonly netProfit: Money;
  readonly marginPct?: Rate;
  readonly markupPct?: Rate;
  readonly status: ResultStatus;
}

export function calculateProfit(
  inputs: ProfitInputs,
): Result<ProfitCalculation, CalcError> {
  // 0. Input validation (fail-fast, typed).
  const validated = validateProfitInputs(inputs);
  if (isErr(validated)) return validated;

  // 1. Total cost.
  const totalCost = inputs.costInputs.productCost.add(
    inputs.costInputs.packagingCost,
  );

  // 2. Discount → effective price.
  const { effectivePrice } = calculateDiscount(
    inputs.sellingPrice,
    inputs.discount,
  );

  // 3. Fees on the effective price.
  const { feeLines, totalFees } = calculateFees(effectivePrice, inputs.profile);

  // 4–5. Net revenue and net profit.
  const netRevenue = effectivePrice.sub(totalFees);
  const netProfit = netRevenue.sub(totalCost);

  // 6–7. Margin (vs effective price) and markup (vs cost), full precision.
  let marginPct: Rate | undefined;
  let markupPct: Rate | undefined;
  let status = ResultStatus.OK;

  if (effectivePrice.isZero()) {
    status = ResultStatus.MARGIN_UNDEFINED;
  } else {
    marginPct = Rate.of(
      netProfit.toDecimal().div(effectivePrice.toDecimal()).toString(),
    );
  }

  if (totalCost.isZero()) {
    // Margin-undefined takes precedence if both are undefined.
    if (status === ResultStatus.OK) status = ResultStatus.MARKUP_UNDEFINED;
  } else {
    markupPct = Rate.of(
      netProfit.toDecimal().div(totalCost.toDecimal()).toString(),
    );
  }

  return ok({
    effectivePrice,
    feeLines,
    totalFees,
    netRevenue,
    netProfit,
    marginPct,
    markupPct,
    status,
  });
}
