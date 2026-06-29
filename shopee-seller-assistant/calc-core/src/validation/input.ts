import {
  type CostInputs,
  type DiscountInput,
  DiscountType,
  type IsoDate,
  Money,
  type ProfitInputs,
  Rate,
  type RecommendInput,
  RecommendationMode,
  SellerTier,
} from '../types';
import {
  type CalcError,
  type Result,
  err,
  inputValidation,
  isErr,
  ok,
} from '../errors';
import { isValidIsoDate } from './date';

/**
 * Input validation (Phase 1 Blueprint §4, user-supplied phase).
 *
 * Operates on already-typed inputs. Parsing / no-float is guaranteed upstream by
 * the Money and Rate value objects; this layer enforces semantic constraints
 * (sign, range, presence, mode-specific requirements). Every failure is
 * RETURNED as a typed INPUT_VALIDATION error — nothing throws.
 */

const TIERS = new Set<string>(Object.values(SellerTier));
const MODES = new Set<string>(Object.values(RecommendationMode));

export function validateSellerTier(
  tier: SellerTier,
): Result<SellerTier, CalcError> {
  if (!TIERS.has(tier)) {
    return err(inputValidation('sellerTier', `unknown tier '${tier}'`));
  }
  return ok(tier);
}

export function validateRecommendationMode(
  mode: RecommendationMode,
): Result<RecommendationMode, CalcError> {
  if (!MODES.has(mode)) {
    return err(inputValidation('mode', `unknown mode '${mode}'`));
  }
  return ok(mode);
}

export function validateAsOfDate(date: IsoDate): Result<IsoDate, CalcError> {
  if (!isValidIsoDate(date)) {
    return err(inputValidation('asOfDate', "must be a valid 'YYYY-MM-DD' date"));
  }
  return ok(date);
}

export function validateCostInputs(
  c: CostInputs,
): Result<CostInputs, CalcError> {
  if (c.productCost.isNegative()) {
    return err(inputValidation('productCost', 'must be >= 0'));
  }
  if (c.packagingCost.isNegative()) {
    return err(inputValidation('packagingCost', 'must be >= 0'));
  }
  return ok(c);
}

export function validateSellingPrice(p: Money): Result<Money, CalcError> {
  if (!p.gt(Money.zero())) {
    return err(inputValidation('sellingPrice', 'must be > 0'));
  }
  return ok(p);
}

/**
 * Validates a discount. A `sellingPrice` bound is applied to FLAT discounts when
 * provided (profit context); it is omitted in the recommend context, where no
 * selling price exists yet.
 */
export function validateDiscount(
  d: DiscountInput,
  sellingPrice?: Money,
): Result<DiscountInput, CalcError> {
  switch (d.type) {
    case DiscountType.NONE:
      if (d.value !== null) {
        return err(
          inputValidation('discount.value', 'must be null when type is NONE'),
        );
      }
      return ok(d);

    case DiscountType.PERCENTAGE: {
      if (!(d.value instanceof Rate)) {
        return err(
          inputValidation('discount.value', 'must be a Rate for PERCENTAGE'),
        );
      }
      const r = d.value.toDecimal();
      if (r.lessThan(0) || r.greaterThan(1)) {
        return err(
          inputValidation(
            'discount.value',
            'percentage fraction must be within [0, 1]',
          ),
        );
      }
      return ok(d);
    }

    case DiscountType.FLAT: {
      if (!(d.value instanceof Money)) {
        return err(
          inputValidation('discount.value', 'must be a Money for FLAT'),
        );
      }
      if (d.value.isNegative()) {
        return err(
          inputValidation('discount.value', 'flat discount must be >= 0'),
        );
      }
      if (sellingPrice !== undefined && d.value.gt(sellingPrice)) {
        return err(
          inputValidation(
            'discount.value',
            'flat discount must be <= selling price',
          ),
        );
      }
      return ok(d);
    }

    default:
      return err(inputValidation('discount.type', 'unknown discount type'));
  }
}

/** Composite validation for the Profit Engine's user inputs. Fail-fast. */
export function validateProfitInputs(
  inp: ProfitInputs,
): Result<ProfitInputs, CalcError> {
  const tier = validateSellerTier(inp.sellerTier);
  if (isErr(tier)) return tier;

  const date = validateAsOfDate(inp.asOfDate);
  if (isErr(date)) return date;

  const cost = validateCostInputs(inp.costInputs);
  if (isErr(cost)) return cost;

  const price = validateSellingPrice(inp.sellingPrice);
  if (isErr(price)) return price;

  const disc = validateDiscount(inp.discount, inp.sellingPrice);
  if (isErr(disc)) return disc;

  return ok(inp);
}

/** Composite validation for the Recommended Price inputs. Fail-fast. */
export function validateRecommendInput(
  inp: RecommendInput,
): Result<RecommendInput, CalcError> {
  const mode = validateRecommendationMode(inp.mode);
  if (isErr(mode)) return mode;

  const tier = validateSellerTier(inp.sellerTier);
  if (isErr(tier)) return tier;

  const date = validateAsOfDate(inp.asOfDate);
  if (isErr(date)) return date;

  const cost = validateCostInputs(inp.costInputs);
  if (isErr(cost)) return cost;

  if (inp.plannedDiscount !== undefined) {
    const pd = validateDiscount(inp.plannedDiscount);
    if (isErr(pd)) return pd;
  }

  switch (inp.mode) {
    case RecommendationMode.TARGET_PROFIT:
      if (inp.targetProfit === undefined) {
        return err(
          inputValidation('targetProfit', 'required for TARGET_PROFIT mode'),
        );
      }
      // Negative profit target is permitted (intentional loss) per blueprint.
      break;

    case RecommendationMode.TARGET_MARGIN: {
      if (inp.targetMargin === undefined) {
        return err(
          inputValidation('targetMargin', 'required for TARGET_MARGIN mode'),
        );
      }
      if (inp.targetMargin.toDecimal().lessThan(0)) {
        return err(inputValidation('targetMargin', 'must be >= 0'));
      }
      break;
    }

    case RecommendationMode.TARGET_MARKUP: {
      if (inp.targetMarkup === undefined) {
        return err(
          inputValidation('targetMarkup', 'required for TARGET_MARKUP mode'),
        );
      }
      if (inp.targetMarkup.toDecimal().lessThan(0)) {
        return err(inputValidation('targetMarkup', 'must be >= 0'));
      }
      // Markup mode requires total cost > 0. Both costs are already validated
      // >= 0 above, so "> 0 in total" holds iff at least one is > 0 — checked
      // without summation to avoid any calculation in the validation layer.
      const zero = Money.zero();
      if (
        !(
          inp.costInputs.productCost.gt(zero) ||
          inp.costInputs.packagingCost.gt(zero)
        )
      ) {
        return err(
          inputValidation('costInputs', 'total cost must be > 0 for markup mode'),
        );
      }
      break;
    }

    case RecommendationMode.MIN_VIABLE:
      // No required target.
      break;
  }

  if (inp.safetyBuffer !== undefined) {
    if (inp.safetyBuffer.toDecimal().lessThan(0)) {
      return err(inputValidation('safetyBuffer', 'must be >= 0'));
    }
  }

  return ok(inp);
}
