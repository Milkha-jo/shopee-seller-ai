import Decimal from 'decimal.js';

/**
 * A dedicated, CLONED Decimal constructor.
 *
 * Cloning (instead of `Decimal.set`) means we never mutate the global Decimal
 * configuration, so behaviour is deterministic regardless of what any other
 * code does with the shared Decimal. All money values flow through `D`.
 *
 * - precision 40: ample headroom for IDR amounts (up to ~1e12) multiplied by
 *   4-dp rate fractions; intermediate products stay exact.
 * - toExpNeg/toExpPos pushed far out so `toString()` never emits exponential
 *   notation within our operating range (keeps output deterministic & readable).
 */
export const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9e15,
  toExpPos: 9e15,
});

export type Dec = Decimal;

/**
 * Round to a whole rupiah, HALF_UP (ties away from zero).
 * Used for per-fee rounding and discount amounts (Profit Engine F-4).
 */
export function roundHalfUpToInt(d: Dec): Dec {
  return d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/**
 * Round UP to a whole rupiah (toward +Infinity).
 * Used for break-even and recommended prices so a target is never undershot.
 */
export function ceilToInt(d: Dec): Dec {
  return d.toDecimalPlaces(0, Decimal.ROUND_CEIL);
}
