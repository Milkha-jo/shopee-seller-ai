import type { CalcError } from '@core/errors';

export interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

/** A transport-level error carrying an HTTP status and a typed body. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  body(): ErrorBody {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

export const badRequest = (code: string, message: string, details?: unknown): HttpError =>
  new HttpError(400, code, message, details);

export const unauthorized = (message = 'Authentication required'): HttpError =>
  new HttpError(401, 'UNAUTHORIZED', message);

export const notFound = (message = 'Resource not found'): HttpError =>
  new HttpError(404, 'NOT_FOUND', message);

/** Map a domain CalcError onto a 400 HttpError, preserving the typed kind and
 *  any field/rule so the frontend can branch on it. */
export function fromCalcError(e: CalcError): HttpError {
  const details: Record<string, unknown> = { kind: e.kind };
  for (const [k, v] of Object.entries(e)) {
    if (k !== 'kind') details[k] = v;
  }
  return new HttpError(400, e.kind, describe(e), details);
}

function describe(e: CalcError): string {
  switch (e.kind) {
    case 'INPUT_VALIDATION':
      return `${e.field}: ${e.rule}`;
    case 'INVALID_RATE':
      return `invalid rate for ${e.feeType}: ${e.value}`;
    case 'INVALID_CAP':
      return `invalid cap for ${e.feeType}: ${e.value}`;
    case 'MISSING_FEE_TYPE':
      return `missing fee type: ${e.feeType}`;
    case 'NO_EFFECTIVE_FEE':
      return `no effective ${e.feeType} fee as of ${e.date}`;
    case 'OVERLAPPING_FEE_WINDOW':
      return `overlapping fee window for ${e.feeType}`;
    case 'UNSUPPORTED_FEE_TYPE':
      return `unsupported fee type: ${e.feeType}`;
  }
}
