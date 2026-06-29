import { type FeeRateRow, FeeType } from '../types';
import {
  type CalcError,
  type Result,
  err,
  inputValidation,
  invalidCap,
  invalidRate,
  missingFeeType,
  ok,
  overlappingFeeWindow,
} from '../errors';
import { OPEN_ENDED, isValidIsoDate } from './date';

/**
 * Config validation (Phase 1 Blueprint §4, fee-data phase).
 *
 * Checks the STRUCTURAL INTEGRITY of a fee-row set, independent of any single
 * date:
 *   1. Per-row validity: rate in [0,1], cap null or >= 0, well-formed dates.
 *   2. Completeness (G-3): each of admin/service/payment present at least once.
 *   3. Overlap (G-4 → HALT): no two rows of one fee type have overlapping
 *      effective windows.
 *
 * Out of scope here (deferred to the resolver): selecting the row effective on a
 * specific date and the resulting NO_EFFECTIVE_FEE condition. That is resolution,
 * not validation.
 *
 * G-2 (no FLAT fees) is enforced structurally by the type system — `FeeRateRow`
 * has no flat-fee representation — and at the Phase 2 ingestion boundary; no
 * runtime FLAT check is needed (or possible) here.
 *
 * All failures are RETURNED as typed errors; nothing throws. Fail-fast.
 */

const REQUIRED_FEE_TYPES: readonly FeeType[] = [
  FeeType.ADMIN,
  FeeType.SERVICE,
  FeeType.PAYMENT,
];

export function validateFeeRows(
  rows: readonly FeeRateRow[],
): Result<readonly FeeRateRow[], CalcError> {
  // 1. Per-row validity.
  for (const row of rows) {
    const r = row.rate.toDecimal();
    if (r.lessThan(0) || r.greaterThan(1)) {
      return err(invalidRate(row.feeType, r.toString()));
    }
    if (row.cap !== null && row.cap.isNegative()) {
      return err(invalidCap(row.feeType, row.cap.toString()));
    }
    if (!isValidIsoDate(row.effectiveDate)) {
      return err(
        inputValidation(
          'feeRow.effectiveDate',
          `invalid date '${row.effectiveDate}' for ${row.feeType}`,
        ),
      );
    }
    if (row.endDate !== null) {
      if (!isValidIsoDate(row.endDate)) {
        return err(
          inputValidation(
            'feeRow.endDate',
            `invalid date '${row.endDate}' for ${row.feeType}`,
          ),
        );
      }
      if (row.endDate < row.effectiveDate) {
        return err(
          inputValidation(
            'feeRow.endDate',
            `endDate before effectiveDate for ${row.feeType}`,
          ),
        );
      }
    }
  }

  // 2. Completeness (G-3).
  for (const ft of REQUIRED_FEE_TYPES) {
    if (!rows.some((r) => r.feeType === ft)) {
      return err(missingFeeType(ft));
    }
  }

  // 3. Overlap (G-4 → HALT).
  for (const ft of REQUIRED_FEE_TYPES) {
    const group = rows.filter((r) => r.feeType === ft);
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (windowsOverlap(group[i]!, group[j]!)) {
          return err(overlappingFeeWindow(ft));
        }
      }
    }
  }

  return ok(rows);
}

/** Inclusive overlap test on ISO date strings (lexicographic compare is valid). */
function windowsOverlap(a: FeeRateRow, b: FeeRateRow): boolean {
  const aStart = a.effectiveDate;
  const aEnd = a.endDate ?? OPEN_ENDED;
  const bStart = b.effectiveDate;
  const bEnd = b.endDate ?? OPEN_ENDED;
  return aStart <= bEnd && bStart <= aEnd;
}
