import { type DiscountInput, DiscountType, Money, Rate } from '../types';
import { InvariantViolationError } from '../errors';

/**
 * Discount module (Phase 1 — Step 6).
 *
 * Pure function. Given a selling price and a discount, returns the discount
 * amount and the resulting effective price.
 *
 *   NONE        → discount = 0
 *   PERCENTAGE  → discount = roundHalfUp(sellingPrice × rate), clamped ≤ price
 *   FLAT        → discount = value, clamped ≤ price
 *   effective   = sellingPrice − discountAmount   (always ≥ 0, via clamp)
 *
 * Value-type correctness is guaranteed upstream by validation; a mismatched
 * value here is a contract breach (programmer error) and throws an
 * InvariantViolationError rather than returning a typed error.
 */

export interface DiscountResult {
  readonly discountAmount: Money;
  readonly effectivePrice: Money;
}

export function calculateDiscount(
  sellingPrice: Money,
  discount: DiscountInput,
): DiscountResult {
  let discountAmount: Money;

  switch (discount.type) {
    case DiscountType.NONE:
      discountAmount = Money.zero();
      break;

    case DiscountType.PERCENTAGE: {
      if (!(discount.value instanceof Rate)) {
        throw new InvariantViolationError(
          'PERCENTAGE discount requires a Rate value (validate upstream).',
        );
      }
      const raw = sellingPrice.mul(discount.value.toDecimal()).roundHalfUp();
      discountAmount = raw.min(sellingPrice); // clamp ≤ price
      break;
    }

    case DiscountType.FLAT: {
      if (!(discount.value instanceof Money)) {
        throw new InvariantViolationError(
          'FLAT discount requires a Money value (validate upstream).',
        );
      }
      discountAmount = discount.value.min(sellingPrice); // clamp ≤ price
      break;
    }

    default:
      throw new InvariantViolationError(
        `Unknown discount type: ${String(discount.type)}`,
      );
  }

  const effectivePrice = sellingPrice.sub(discountAmount);
  return { discountAmount, effectivePrice };
}
