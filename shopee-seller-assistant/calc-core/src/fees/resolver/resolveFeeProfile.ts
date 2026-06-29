import {
  type FeeRateRow,
  type IsoDate,
  type ResolvedFee,
  type ResolvedFeeProfile,
  FeeType,
  SellerTier,
} from '../../types';
import {
  type CalcError,
  type Result,
  err,
  isErr,
  noEffectiveFee,
  ok,
  overlappingFeeWindow,
} from '../../errors';
import {
  validateAsOfDate,
  validateFeeRows,
  validateSellerTier,
} from '../../validation';

/**
 * Fee Resolver (Phase 1 — Step 4).
 *
 * Pure, in-memory. Given a seller tier, a date, and a set of fee rows, it
 * returns a complete `ResolvedFeeProfile` (admin + service + payment) or a
 * typed `Result` error. No I/O, no calculation of fees/profit/break-even, no
 * categories, no discounts.
 *
 * Tier note (G-1): the approved `FeeRateRow` type carries no seller tier, so the
 * provided rows are taken to be already scoped to `sellerTier` (the caller's
 * contract). The tier is recorded on the resolved profile; no tier re-filter is
 * performed, and no category or fallback profile is involved.
 */

const REQUIRED_FEE_TYPES: readonly FeeType[] = [
  FeeType.ADMIN,
  FeeType.SERVICE,
  FeeType.PAYMENT,
];

export function resolveFeeProfile(
  sellerTier: SellerTier,
  asOfDate: IsoDate,
  rows: readonly FeeRateRow[],
): Result<ResolvedFeeProfile, CalcError> {
  // Input guards (existing validators only; no new logic).
  const tier = validateSellerTier(sellerTier);
  if (isErr(tier)) return tier;

  const date = validateAsOfDate(asOfDate);
  if (isErr(date)) return date;

  // 1. Config validation: per-row validity, completeness (G-3), overlap (G-4).
  const config = validateFeeRows(rows);
  if (isErr(config)) return config;

  // 2. Rows are already scoped to the requested tier (see tier note above).
  const candidates = rows;

  // 3–6. For each required fee type, resolve exactly one effective row.
  const resolved: Partial<Record<FeeType, ResolvedFee>> = {};
  for (const feeType of REQUIRED_FEE_TYPES) {
    const effective = candidates.filter(
      (r) => r.feeType === feeType && isEffectiveOn(r, asOfDate),
    );

    if (effective.length === 0) {
      return err(noEffectiveFee(feeType, asOfDate));
    }
    if (effective.length > 1) {
      // Defensive halt: two rows effective on the same date overlap. Config
      // validation already rejects overlaps across the full set; this guards
      // the resolution path itself and never silently picks one (G-4).
      return err(overlappingFeeWindow(feeType));
    }

    const row = effective[0]!;
    resolved[feeType] = { feeType, rate: row.rate, cap: row.cap };
  }

  // 7. Assemble. All three are guaranteed present by the loop above.
  const profile: ResolvedFeeProfile = {
    sellerTier,
    asOfDate,
    admin: resolved[FeeType.ADMIN]!,
    service: resolved[FeeType.SERVICE]!,
    payment: resolved[FeeType.PAYMENT]!,
  };
  return ok(profile);
}

/** Inclusive window test on ISO date strings (lexicographic compare is valid). */
function isEffectiveOn(row: FeeRateRow, date: IsoDate): boolean {
  return (
    row.effectiveDate <= date && (row.endDate === null || date <= row.endDate)
  );
}
