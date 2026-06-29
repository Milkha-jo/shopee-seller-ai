/**
 * Thrown ONLY for invariant violations — states that should be impossible if the
 * code is correct (programmer errors, broken assumptions, round-trip failures).
 *
 * Expected business outcomes (bad user input, fee-config problems, undefined
 * margin, infeasible targets) are NEVER thrown — they are returned via `Result`.
 */
export class InvariantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantViolationError';
    // Preserve instanceof across transpilation targets.
    Object.setPrototypeOf(this, InvariantViolationError.prototype);
  }
}
