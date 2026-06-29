import {
  type ResolvedFee,
  type ResolvedFeeProfile,
  FeeType,
  Money,
  ResultStatus,
} from '../types';
import { InvariantViolationError } from '../errors';
import { D, roundHalfUpToInt } from '../money';

/**
 * Break-even solver (Phase 1 — Step 7).
 *
 * Computes the minimum *effective* selling price that yields zero profit while
 * respecting capped fees, using the cap-correction loop. Pure calculation: no
 * recommendation, round-trip, gross-up, discount, or resolution.
 *
 * Cap-correction loop (≤ fees + 1 passes):
 *   r_active = Σ rate of fees NOT currently bound
 *   flat     = Σ cap  of fees currently bound
 *   E        = (totalCost + flat) / (1 − r_active)      // NO_SOLUTION if denom ≤ 0
 *   a fee is bound iff roundHalfUp(rate × E) ≥ cap      // recomputed every pass
 *   repeat until the bound set is stable; return ceil(E)
 *
 * Convergence is mathematically guaranteed; exceeding the guard is an
 * InvariantViolationError.
 */

export interface BreakEvenCalculation {
  readonly price: Money | null;
  readonly bindingCaps: readonly FeeType[];
  readonly status: ResultStatus;
}

export function calculateBreakEven(
  totalCost: Money,
  profile: ResolvedFeeProfile,
): BreakEvenCalculation {
  const fees: readonly ResolvedFee[] = [
    profile.admin,
    profile.service,
    profile.payment,
  ];
  const maxPasses = fees.length + 1;

  let bound = new Set<FeeType>();
  let solvedE = new D(0);
  let pass = 0;

  while (true) {
    pass += 1;
    if (pass > maxPasses) {
      throw new InvariantViolationError(
        'break-even cap-correction failed to converge within the iteration guard',
      );
    }

    // 1. r_active = Σ rates of fees not currently bound.
    let rActive = new D(0);
    for (const fee of fees) {
      if (!bound.has(fee.feeType)) {
        rActive = rActive.plus(fee.rate.toDecimal());
      }
    }

    // 2. flat = Σ caps of currently-bound fees.
    let flat = Money.zero();
    for (const fee of fees) {
      if (bound.has(fee.feeType) && fee.cap !== null) {
        flat = flat.add(fee.cap);
      }
    }

    // 3. E = (totalCost + flat) / (1 − r_active).
    const denominator = new D(1).minus(rActive);
    if (denominator.lessThanOrEqualTo(0)) {
      return { price: null, bindingCaps: [], status: ResultStatus.NO_SOLUTION };
    }
    solvedE = totalCost.add(flat).toDecimal().div(denominator);

    // 4. Recompute the bound set from scratch at this E.
    const next = new Set<FeeType>();
    for (const fee of fees) {
      if (fee.cap === null) continue;
      const raw = roundHalfUpToInt(fee.rate.toDecimal().times(solvedE));
      if (raw.greaterThanOrEqualTo(fee.cap.toDecimal())) {
        next.add(fee.feeType);
      }
    }

    // 5. Converged when the bound set is unchanged.
    if (sameSet(bound, next)) {
      bound = next;
      break;
    }
    bound = next;
  }

  // 6. ceil(E); binding caps reported in fee order.
  const price = Money.fromDecimal(solvedE).ceil();
  const bindingCaps = fees
    .filter((fee) => bound.has(fee.feeType))
    .map((fee) => fee.feeType);

  return { price, bindingCaps, status: ResultStatus.OK };
}

function sameSet(a: Set<FeeType>, b: Set<FeeType>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}
