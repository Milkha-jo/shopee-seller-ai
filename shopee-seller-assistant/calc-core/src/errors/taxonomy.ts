/**
 * Returnable error taxonomy (Phase 1 Blueprint §5).
 *
 * These are DATA, carried in the error channel of `Result`. They are tagged
 * unions (discriminated by `kind`) so they are serializable and exhaustively
 * switchable. `feeType` and `date` are kept as plain strings here so that the
 * errors module stays at the very bottom of the dependency graph and never
 * imports the `types` module.
 */

export type CalcErrorKind =
  | 'INPUT_VALIDATION'
  | 'MISSING_FEE_TYPE'
  | 'OVERLAPPING_FEE_WINDOW'
  | 'NO_EFFECTIVE_FEE'
  | 'UNSUPPORTED_FEE_TYPE'
  | 'INVALID_RATE'
  | 'INVALID_CAP';

/** User-supplied input failed a validation rule (recoverable, UX-facing). */
export interface InputValidationError {
  readonly kind: 'INPUT_VALIDATION';
  readonly field: string;
  readonly rule: string;
}

/** A required fee type is absent from a profile (G-3 completeness violation). */
export interface MissingFeeTypeError {
  readonly kind: 'MISSING_FEE_TYPE';
  readonly feeType: string;
}

/** Two effective windows overlap for one fee type (G-4 — HALT). */
export interface OverlappingFeeWindowError {
  readonly kind: 'OVERLAPPING_FEE_WINDOW';
  readonly feeType: string;
}

/** No fee row is effective for the resolution date. */
export interface NoEffectiveFeeError {
  readonly kind: 'NO_EFFECTIVE_FEE';
  readonly feeType: string;
  readonly date: string;
}

/** A FLAT fee was encountered; MVP supports percentage fees only (G-2). */
export interface UnsupportedFeeTypeError {
  readonly kind: 'UNSUPPORTED_FEE_TYPE';
  readonly feeType: string;
}

/** A fee rate is outside the valid [0, 1] fraction range. */
export interface InvalidRateError {
  readonly kind: 'INVALID_RATE';
  readonly feeType: string;
  readonly value: string;
}

/** A fee cap is negative or otherwise invalid. */
export interface InvalidCapError {
  readonly kind: 'INVALID_CAP';
  readonly feeType: string;
  readonly value: string;
}

export type CalcError =
  | InputValidationError
  | MissingFeeTypeError
  | OverlappingFeeWindowError
  | NoEffectiveFeeError
  | UnsupportedFeeTypeError
  | InvalidRateError
  | InvalidCapError;

/* ----------------------------- factories ------------------------------ */

export const inputValidation = (
  field: string,
  rule: string,
): InputValidationError => ({ kind: 'INPUT_VALIDATION', field, rule });

export const missingFeeType = (feeType: string): MissingFeeTypeError => ({
  kind: 'MISSING_FEE_TYPE',
  feeType,
});

export const overlappingFeeWindow = (
  feeType: string,
): OverlappingFeeWindowError => ({ kind: 'OVERLAPPING_FEE_WINDOW', feeType });

export const noEffectiveFee = (
  feeType: string,
  date: string,
): NoEffectiveFeeError => ({ kind: 'NO_EFFECTIVE_FEE', feeType, date });

export const unsupportedFeeType = (
  feeType: string,
): UnsupportedFeeTypeError => ({ kind: 'UNSUPPORTED_FEE_TYPE', feeType });

export const invalidRate = (
  feeType: string,
  value: string,
): InvalidRateError => ({ kind: 'INVALID_RATE', feeType, value });

export const invalidCap = (
  feeType: string,
  value: string,
): InvalidCapError => ({ kind: 'INVALID_CAP', feeType, value });

/** Stable, human-readable description for logs and test diagnostics. */
export function describeError(e: CalcError): string {
  switch (e.kind) {
    case 'INPUT_VALIDATION':
      return `Input invalid: '${e.field}' failed rule '${e.rule}'.`;
    case 'MISSING_FEE_TYPE':
      return `Fee profile is missing required fee type '${e.feeType}'.`;
    case 'OVERLAPPING_FEE_WINDOW':
      return `Overlapping effective windows for fee type '${e.feeType}'.`;
    case 'NO_EFFECTIVE_FEE':
      return `No effective '${e.feeType}' fee for date '${e.date}'.`;
    case 'UNSUPPORTED_FEE_TYPE':
      return `Unsupported fee type '${e.feeType}' (percentage fees only).`;
    case 'INVALID_RATE':
      return `Invalid rate '${e.value}' for fee type '${e.feeType}'.`;
    case 'INVALID_CAP':
      return `Invalid cap '${e.value}' for fee type '${e.feeType}'.`;
  }
}
