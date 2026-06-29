import {
  type DiscountInput,
  type ProfitInputs,
  type ProfitResult,
  type RecommendInput,
  type RecommendResult,
  type ResolvedFee,
  DiscountType,
  FeeType,
  Money,
  Rate,
  RecommendationMode,
  ResultStatus,
} from '../types';
import {
  type CalcError,
  type Result,
  InvariantViolationError,
  err,
  inputValidation,
  isErr,
  ok,
} from '../errors';
import { D, type Dec, roundHalfUpToInt } from '../money';
import { validateRecommendInput } from '../validation';
import { type ProfitCalculation, calculateProfit } from '../profit-engine';
import { calculateBreakEven } from '../break-even';

/**
 * Recommended Price (Phase 1 — Step 8). The composer.
 *
 * Solves entirely in EFFECTIVE-PRICE space, then grosses up to a list price
 * using the planned discount, then round-trips through the forward profit
 * engine and asserts the realized outcome is within ±2 IDR of the target.
 *
 * Modes:
 *   A TARGET_PROFIT  E = (cost + flat + targetProfit) / (1 − r_active)
 *   B TARGET_MARGIN  ceiling = 1 − Σ(rate of UNCAPPED fees);
 *                    infeasible if target ≥ ceiling, else
 *                    E = (cost + flat) / (1 − r_active − targetMargin)
 *   C TARGET_MARKUP  E = (cost × (1+targetMarkup) + flat) / (1 − r_active)
 *   D MIN_VIABLE     E = breakEven × (1 + buffer)   (reuses calculateBreakEven)
 *
 * A/B/C use a shared cap-correction loop mirroring the break-even algorithm,
 * parameterised by each mode's closed form. Feasibility outcomes
 * (INFEASIBLE_CEILING, NO_SOLUTION) are typed RESULTS; a round-trip miss is an
 * invariant violation and throws.
 */

export function recommendPrice(
  input: RecommendInput,
): Result<RecommendResult, CalcError> {
  const validated = validateRecommendInput(input);
  if (isErr(validated)) return validated;

  const totalCost = input.costInputs.productCost.add(
    input.costInputs.packagingCost,
  );
  const fees: readonly ResolvedFee[] = [
    input.profile.admin,
    input.profile.service,
    input.profile.payment,
  ];

  // Break-even floor (reused for mode D and shown with every recommendation).
  const be = calculateBreakEven(totalCost, input.profile);
  if (be.status === ResultStatus.NO_SOLUTION || be.price === null) {
    // Degenerate (rates ≥ 100%): no floor exists. See report note on the
    // non-nullable breakEvenFloor type; Money.zero() is a documented sentinel
    // that callers must ignore when status is NO_SOLUTION.
    return ok(noSolution(Money.zero()));
  }
  const breakEvenFloor = be.price;

  // Mode dispatch → effective price (or a typed non-OK outcome).
  const outcome = solveEffective(input, fees, totalCost, breakEvenFloor);
  if (outcome.kind === 'INPUT_ERROR') return err(outcome.error);
  if (outcome.kind === 'NO_SOLUTION') return ok(noSolution(breakEvenFloor));
  if (outcome.kind === 'INFEASIBLE_CEILING') {
    return ok(infeasibleCeiling(breakEvenFloor, outcome.ceiling));
  }
  const effective = outcome.effective;

  // Gross-up to list price using the planned discount.
  const gross = grossUp(effective, input.plannedDiscount);
  if (gross.kind === 'NO_SOLUTION') return ok(noSolution(breakEvenFloor));
  const listPrice = gross.list;

  // Round-trip through the forward profit engine.
  const roundTripInputs: ProfitInputs = {
    costInputs: input.costInputs,
    sellingPrice: listPrice,
    discount: input.plannedDiscount ?? { type: DiscountType.NONE, value: null },
    sellerTier: input.sellerTier,
    asOfDate: input.asOfDate,
    profile: input.profile,
  };
  const profit = calculateProfit(roundTripInputs);
  if (isErr(profit)) return profit; // defensive; inputs are already valid
  const pc = profit.value;

  // Tolerance check (±2 IDR). A miss is a solver bug → throw.
  assertRoundTrip(input, pc, totalCost, listPrice, breakEvenFloor);

  const roundTrip: ProfitResult = {
    effectivePrice: pc.effectivePrice,
    feeLines: pc.feeLines,
    totalFees: pc.totalFees,
    netRevenue: pc.netRevenue,
    netProfit: pc.netProfit,
    marginPct: pc.marginPct,
    markupPct: pc.markupPct,
    breakEvenPrice: breakEvenFloor,
    status: pc.status,
  };

  return ok({
    recommendedPrice: listPrice,
    roundTrip,
    breakEvenFloor,
    feasibility: ResultStatus.OK,
    status: ResultStatus.OK,
  });
}

/* --------------------------- mode dispatch ---------------------------- */

type ModeOutcome =
  | { kind: 'OK'; effective: Dec }
  | { kind: 'INFEASIBLE_CEILING'; ceiling: Rate }
  | { kind: 'NO_SOLUTION' }
  | { kind: 'INPUT_ERROR'; error: CalcError };

function solveEffective(
  input: RecommendInput,
  fees: readonly ResolvedFee[],
  totalCost: Money,
  breakEvenFloor: Money,
): ModeOutcome {
  switch (input.mode) {
    case RecommendationMode.TARGET_PROFIT: {
      if (input.targetProfit === undefined) {
        return missing('targetProfit', 'TARGET_PROFIT');
      }
      const target = input.targetProfit;
      const solved = capCorrect(fees, (r, flat) => {
        const denom = new D(1).minus(r);
        if (denom.lessThanOrEqualTo(0)) return null;
        return totalCost.add(flat).add(target).toDecimal().div(denom);
      });
      return solved.kind === 'OK'
        ? { kind: 'OK', effective: solved.E }
        : { kind: 'NO_SOLUTION' };
    }

    case RecommendationMode.TARGET_MARGIN: {
      if (input.targetMargin === undefined) {
        return missing('targetMargin', 'TARGET_MARGIN');
      }
      const margin = input.targetMargin.toDecimal();
      const ceiling = ceilingFraction(fees);
      if (margin.greaterThanOrEqualTo(ceiling)) {
        return { kind: 'INFEASIBLE_CEILING', ceiling: Rate.of(ceiling.toString()) };
      }
      const solved = capCorrect(fees, (r, flat) => {
        const denom = new D(1).minus(r).minus(margin);
        if (denom.lessThanOrEqualTo(0)) return null;
        return totalCost.add(flat).toDecimal().div(denom);
      });
      return solved.kind === 'OK'
        ? { kind: 'OK', effective: solved.E }
        : { kind: 'NO_SOLUTION' };
    }

    case RecommendationMode.TARGET_MARKUP: {
      if (input.targetMarkup === undefined) {
        return missing('targetMarkup', 'TARGET_MARKUP');
      }
      // validation guarantees totalCost > 0 in this mode
      const onePlusK = new D(1).plus(input.targetMarkup.toDecimal());
      const solved = capCorrect(fees, (r, flat) => {
        const denom = new D(1).minus(r);
        if (denom.lessThanOrEqualTo(0)) return null;
        return totalCost.mul(onePlusK).add(flat).toDecimal().div(denom);
      });
      return solved.kind === 'OK'
        ? { kind: 'OK', effective: solved.E }
        : { kind: 'NO_SOLUTION' };
    }

    case RecommendationMode.MIN_VIABLE: {
      const buffer = input.safetyBuffer
        ? input.safetyBuffer.toDecimal()
        : new D(0);
      const effective = breakEvenFloor.toDecimal().times(new D(1).plus(buffer));
      return { kind: 'OK', effective };
    }

    default:
      return {
        kind: 'INPUT_ERROR',
        error: inputValidation('mode', 'unknown recommendation mode'),
      };
  }
}

function missing(field: string, mode: string): ModeOutcome {
  return {
    kind: 'INPUT_ERROR',
    error: inputValidation(field, `required for ${mode} mode`),
  };
}

/* ----------------------- shared cap-correction ------------------------ */

type Solve = (rActive: Dec, flat: Money) => Dec | null;

function capCorrect(
  fees: readonly ResolvedFee[],
  solve: Solve,
): { kind: 'OK'; E: Dec } | { kind: 'NO_SOLUTION' } {
  const maxPasses = fees.length + 1;
  let bound = new Set<FeeType>();
  let E = new D(0);
  let pass = 0;

  while (true) {
    pass += 1;
    if (pass > maxPasses) {
      throw new InvariantViolationError(
        'recommend cap-correction failed to converge within the iteration guard',
      );
    }

    let rActive = new D(0);
    for (const fee of fees) {
      if (!bound.has(fee.feeType)) {
        rActive = rActive.plus(fee.rate.toDecimal());
      }
    }

    let flat = Money.zero();
    for (const fee of fees) {
      if (bound.has(fee.feeType) && fee.cap !== null) {
        flat = flat.add(fee.cap);
      }
    }

    const solved = solve(rActive, flat);
    if (solved === null) {
      // Denominator ≤ 0 with the current binding set. Capped fees may still bind
      // at higher prices (the feasibility ceiling excludes capped rates), so
      // force-bind any not-yet-bound capped fees and retry before giving up.
      const forced = new Set(bound);
      for (const fee of fees) {
        if (fee.cap !== null) forced.add(fee.feeType);
      }
      if (forced.size === bound.size) return { kind: 'NO_SOLUTION' };
      bound = forced;
      continue;
    }
    E = solved;

    const next = new Set<FeeType>();
    for (const fee of fees) {
      if (fee.cap === null) continue;
      const raw = roundHalfUpToInt(fee.rate.toDecimal().times(E));
      if (raw.greaterThanOrEqualTo(fee.cap.toDecimal())) {
        next.add(fee.feeType);
      }
    }

    if (sameSet(bound, next)) {
      bound = next;
      break;
    }
    bound = next;
  }

  return { kind: 'OK', E };
}

function ceilingFraction(fees: readonly ResolvedFee[]): Dec {
  let sum = new D(0);
  for (const fee of fees) {
    if (fee.cap === null) sum = sum.plus(fee.rate.toDecimal());
  }
  return new D(1).minus(sum);
}

function sameSet(a: Set<FeeType>, b: Set<FeeType>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}

/* ------------------------------ gross-up ------------------------------ */

function grossUp(
  effective: Dec,
  planned: DiscountInput | undefined,
): { kind: 'OK'; list: Money } | { kind: 'NO_SOLUTION' } {
  if (planned === undefined || planned.type === DiscountType.NONE) {
    return { kind: 'OK', list: Money.fromDecimal(effective).ceil() };
  }

  if (planned.type === DiscountType.PERCENTAGE) {
    if (!(planned.value instanceof Rate)) {
      throw new InvariantViolationError(
        'PERCENTAGE planned discount requires a Rate value.',
      );
    }
    const denom = new D(1).minus(planned.value.toDecimal());
    if (denom.lessThanOrEqualTo(0)) return { kind: 'NO_SOLUTION' };
    return { kind: 'OK', list: Money.fromDecimal(effective.div(denom)).ceil() };
  }

  // FLAT: effective = list − flat, so list = ceil(effective + flat).
  if (!(planned.value instanceof Money)) {
    throw new InvariantViolationError(
      'FLAT planned discount requires a Money value.',
    );
  }
  return {
    kind: 'OK',
    list: Money.fromDecimal(effective).add(planned.value).ceil(),
  };
}

/* --------------------------- round-trip ------------------------------- */

function assertRoundTrip(
  input: RecommendInput,
  pc: ProfitCalculation,
  totalCost: Money,
  listPrice: Money,
  breakEvenFloor: Money,
): void {
  const tolerance = Money.fromRupiah(2);
  const realized = pc.netProfit;

  if (input.mode === RecommendationMode.MIN_VIABLE) {
    // Break-even legitimately lands within ±2 IDR of zero (G-5), so accept
    // realized ≥ −2 rather than ≥ 0; only a genuine shortfall below tolerance
    // (or a price under the floor) is an invariant violation.
    if (realized.lt(tolerance.neg()) || listPrice.lt(breakEvenFloor)) {
      throw new InvariantViolationError(
        `round-trip failed (MIN_VIABLE): profit=${realized.toString()}, ` +
          `list=${listPrice.toString()}, floor=${breakEvenFloor.toString()}`,
      );
    }
    return;
  }

  let implied: Money;
  switch (input.mode) {
    case RecommendationMode.TARGET_PROFIT:
      implied = input.targetProfit!;
      break;
    case RecommendationMode.TARGET_MARGIN:
      implied = pc.effectivePrice.mul(input.targetMargin!.toDecimal());
      break;
    case RecommendationMode.TARGET_MARKUP:
      implied = totalCost.mul(input.targetMarkup!.toDecimal());
      break;
    default:
      return;
  }

  if (realized.sub(implied).abs().gt(tolerance)) {
    throw new InvariantViolationError(
      `round-trip tolerance exceeded (${input.mode}): ` +
        `realized=${realized.toString()}, implied=${implied.toString()}`,
    );
  }
}

/* ----------------------------- builders ------------------------------- */

function noSolution(floor: Money): RecommendResult {
  return {
    recommendedPrice: null,
    roundTrip: null,
    breakEvenFloor: floor,
    feasibility: ResultStatus.NO_SOLUTION,
    status: ResultStatus.NO_SOLUTION,
  };
}

function infeasibleCeiling(floor: Money, ceiling: Rate): RecommendResult {
  return {
    recommendedPrice: null,
    roundTrip: null,
    breakEvenFloor: floor,
    feasibility: ResultStatus.INFEASIBLE_CEILING,
    ceiling,
    status: ResultStatus.INFEASIBLE_CEILING,
  };
}
