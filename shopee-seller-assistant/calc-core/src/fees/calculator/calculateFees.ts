import {
  type FeeLine,
  type ResolvedFee,
  type ResolvedFeeProfile,
  Money,
} from '../../types';

/**
 * Fee Calculator (Phase 1 — Step 5).
 *
 * Pure function. Given an effective price and a resolved fee profile, it
 * computes one `FeeLine` per fee (admin, service, payment) and the total.
 *
 * Per fee (Blueprint §6/§7a):
 *   rawFee     = roundHalfUp(rate × effectivePrice)   // from the unrounded base
 *   appliedFee = cap == null ? rawFee : min(rawFee, cap)
 *   capBound   = cap != null && rawFee >= cap
 *   totalFees  = Σ appliedFee                          // sum of rounded lines
 *
 * No I/O, no resolver logic, no profit/break-even/discount calculation.
 */

export interface FeeCalculation {
  readonly feeLines: readonly FeeLine[];
  readonly totalFees: Money;
}

export function calculateFees(
  effectivePrice: Money,
  profile: ResolvedFeeProfile,
): FeeCalculation {
  // Fixed order for deterministic output: admin, service, payment.
  const feeLines: FeeLine[] = [
    computeLine(effectivePrice, profile.admin),
    computeLine(effectivePrice, profile.service),
    computeLine(effectivePrice, profile.payment),
  ];

  let totalFees = Money.zero();
  for (const line of feeLines) {
    totalFees = totalFees.add(line.appliedFee);
  }

  return { feeLines, totalFees };
}

function computeLine(base: Money, fee: ResolvedFee): FeeLine {
  const rawFee = base.mul(fee.rate.toDecimal()).roundHalfUp();
  const appliedFee = fee.cap === null ? rawFee : rawFee.min(fee.cap);
  const capBound = fee.cap !== null && rawFee.gte(fee.cap);
  return { feeType: fee.feeType, base, rawFee, appliedFee, capBound };
}
