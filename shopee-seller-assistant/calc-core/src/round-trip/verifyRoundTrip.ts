import {
  type ProfitInputs,
  type RecommendInput,
  type RecommendResult,
  DiscountType,
  Money,
  RecommendationMode,
} from '../types';
import { isErr } from '../errors';
import { calculateProfit } from '../profit-engine';

/**
 * Round-trip validation (Phase 1 — Step 9).
 *
 * Independent verifier: re-runs the forward profit engine at a recommendation's
 * list price (with the planned discount) and checks the realized outcome
 * against the mode's target within the ±2 IDR tolerance. Unlike the assertion
 * embedded in recommend-price (which throws), this returns a structured check
 * so it can be used as the final-verification layer and by property tests.
 *
 * profit-engine is the single forward source of truth; no formula is
 * re-derived here. Targets per mode (blueprint §8):
 *   A TARGET_PROFIT  implied = targetProfit
 *   B TARGET_MARGIN  implied = targetMargin × realized effective price
 *   C TARGET_MARKUP  implied = targetMarkup × total cost
 *   D MIN_VIABLE     realized ≥ 0 AND list price ≥ break-even floor
 */

const TOLERANCE = Money.fromRupiah(2);

export interface RoundTripCheck {
  /** False when there is no recommended price to verify (infeasible / no solution). */
  readonly applicable: boolean;
  readonly passed: boolean;
  readonly realizedProfit: Money | null;
  /** Implied target profit for modes A/B/C; null for mode D (floor check). */
  readonly impliedProfit: Money | null;
  /** |realized − implied| for A/B/C; null for mode D. */
  readonly differenceAbs: Money | null;
}

export function verifyRoundTrip(
  input: RecommendInput,
  result: RecommendResult,
): RoundTripCheck {
  if (result.recommendedPrice === null) {
    // Infeasible or no-solution: nothing to round-trip, vacuously passes.
    return {
      applicable: false,
      passed: true,
      realizedProfit: null,
      impliedProfit: null,
      differenceAbs: null,
    };
  }

  const totalCost = input.costInputs.productCost.add(
    input.costInputs.packagingCost,
  );

  const forwardInputs: ProfitInputs = {
    costInputs: input.costInputs,
    sellingPrice: result.recommendedPrice,
    discount: input.plannedDiscount ?? { type: DiscountType.NONE, value: null },
    sellerTier: input.sellerTier,
    asOfDate: input.asOfDate,
    profile: input.profile,
  };

  const forward = calculateProfit(forwardInputs);
  if (isErr(forward)) {
    // A recommended price should always validate; if not, the round-trip fails.
    return {
      applicable: true,
      passed: false,
      realizedProfit: null,
      impliedProfit: null,
      differenceAbs: null,
    };
  }
  const pc = forward.value;
  const realized = pc.netProfit;

  if (input.mode === RecommendationMode.MIN_VIABLE) {
    const passed =
      realized.gte(TOLERANCE.neg()) &&
      result.recommendedPrice.gte(result.breakEvenFloor);
    return {
      applicable: true,
      passed,
      realizedProfit: realized,
      impliedProfit: null,
      differenceAbs: null,
    };
  }

  let implied: Money;
  switch (input.mode) {
    case RecommendationMode.TARGET_PROFIT:
      if (input.targetProfit === undefined) {
        return notApplicableFailure(realized);
      }
      implied = input.targetProfit;
      break;
    case RecommendationMode.TARGET_MARGIN:
      if (input.targetMargin === undefined) {
        return notApplicableFailure(realized);
      }
      implied = pc.effectivePrice.mul(input.targetMargin.toDecimal());
      break;
    case RecommendationMode.TARGET_MARKUP:
      if (input.targetMarkup === undefined) {
        return notApplicableFailure(realized);
      }
      implied = totalCost.mul(input.targetMarkup.toDecimal());
      break;
    default:
      return notApplicableFailure(realized);
  }

  const differenceAbs = realized.sub(implied).abs();
  return {
    applicable: true,
    passed: differenceAbs.lte(TOLERANCE),
    realizedProfit: realized,
    impliedProfit: implied,
    differenceAbs,
  };
}

function notApplicableFailure(realized: Money): RoundTripCheck {
  return {
    applicable: true,
    passed: false,
    realizedProfit: realized,
    impliedProfit: null,
    differenceAbs: null,
  };
}
