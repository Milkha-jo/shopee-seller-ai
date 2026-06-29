import { InvariantViolationError } from '../errors';
import { D, Dec, ceilToInt, roundHalfUpToInt } from './rounding';

/**
 * Accepted public constructor inputs. Fractional values must be passed as exact
 * decimal strings. The raw decimal.js type is intentionally NOT part of this
 * public union; `Money.fromDecimal` remains as an explicit escape hatch.
 */
export type MoneyInput = string | number | Money;

/**
 * An immutable monetary amount in IDR, backed by decimal.js.
 *
 * A Money may hold a fractional value (e.g. the raw result of rate × base)
 * until it is explicitly rounded to whole rupiah via `roundHalfUp()` or
 * `ceil()`. No JavaScript floating-point arithmetic is ever performed on the
 * amount; every operation goes through the isolated Decimal constructor `D`.
 */
export class Money {
  private readonly d: Dec;

  private constructor(d: Dec) {
    this.d = d;
  }

  /**
   * Build from a whole-rupiah integer (number) or an exact decimal string.
   * A non-integer `number` is rejected: passing a float (e.g. 0.1) is a
   * programmer error because it may already carry binary rounding. Use a
   * string for any fractional literal.
   */
  static fromRupiah(value: string | number): Money {
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value)) {
        throw new InvariantViolationError(
          `Money.fromRupiah expects a safe integer rupiah amount; ` +
            `use a string for fractional or very large values. Received ${value}.`,
        );
      }
      return new Money(new D(value));
    }
    let d: Dec;
    try {
      d = new D(value);
    } catch {
      throw new InvariantViolationError(`Invalid money string: '${value}'.`);
    }
    if (d.isNaN() || !d.isFinite()) {
      throw new InvariantViolationError(`Invalid money string: '${value}'.`);
    }
    return new Money(d);
  }

  /** Wrap an existing Decimal (re-normalised into the isolated constructor). */
  static fromDecimal(value: Dec): Money {
    const d = new D(value);
    if (d.isNaN() || !d.isFinite()) {
      throw new InvariantViolationError('Invalid decimal money value.');
    }
    return new Money(d);
  }

  static zero(): Money {
    return new Money(new D(0));
  }

  static of(value: MoneyInput): Money {
    if (value instanceof Money) return value;
    return Money.fromRupiah(value);
  }

  /* ----------------------------- arithmetic ---------------------------- */

  add(other: Money): Money {
    return new Money(this.d.plus(other.d));
  }

  sub(other: Money): Money {
    return new Money(this.d.minus(other.d));
  }

  /**
   * Multiply by a factor. Fractional factors (e.g. a rate "0.02") must be a
   * string or Decimal — exact, no float. A `number` factor must be an integer
   * (e.g. a unit count); a fractional number is rejected.
   */
  mul(factor: string | number | Dec): Money {
    if (typeof factor === 'number') {
      if (!Number.isSafeInteger(factor)) {
        throw new InvariantViolationError(
          `Money.mul number factor must be a safe integer; ` +
            `use a string for fractional factors. Received ${factor}.`,
        );
      }
      return new Money(this.d.times(factor));
    }
    // string | Decimal — both parsed exactly by decimal.js
    return new Money(this.d.times(factor));
  }

  neg(): Money {
    return new Money(this.d.negated());
  }

  abs(): Money {
    return new Money(this.d.abs());
  }

  /* ------------------------------ rounding ----------------------------- */

  roundHalfUp(): Money {
    return new Money(roundHalfUpToInt(this.d));
  }

  ceil(): Money {
    return new Money(ceilToInt(this.d));
  }

  /* ---------------------------- comparisons ---------------------------- */

  min(other: Money): Money {
    return this.d.lessThanOrEqualTo(other.d) ? this : other;
  }

  max(other: Money): Money {
    return this.d.greaterThanOrEqualTo(other.d) ? this : other;
  }

  eq(other: Money): boolean {
    return this.d.equals(other.d);
  }

  gt(other: Money): boolean {
    return this.d.greaterThan(other.d);
  }

  gte(other: Money): boolean {
    return this.d.greaterThanOrEqualTo(other.d);
  }

  lt(other: Money): boolean {
    return this.d.lessThan(other.d);
  }

  lte(other: Money): boolean {
    return this.d.lessThanOrEqualTo(other.d);
  }

  /* ----------------------------- predicates ---------------------------- */

  isZero(): boolean {
    return this.d.isZero();
  }

  isNegative(): boolean {
    return this.d.isNegative() && !this.d.isZero();
  }

  isInteger(): boolean {
    return this.d.isInteger();
  }

  /* --------------------------- serialisation --------------------------- */

  /** A copy of the underlying decimal (callers cannot mutate internal state). */
  toDecimal(): Dec {
    return new D(this.d);
  }

  /**
   * Convert to a JS number. Only valid for a whole-rupiah amount within the
   * safe integer range — otherwise a float would be produced, violating the
   * no-float guarantee, so it throws. Round before calling.
   */
  toNumber(): number {
    if (!this.d.isInteger()) {
      throw new InvariantViolationError(
        `toNumber() requires a whole-rupiah amount; round first. ` +
          `Value=${this.d.toString()}.`,
      );
    }
    const n = this.d.toNumber();
    if (!Number.isSafeInteger(n)) {
      throw new InvariantViolationError(
        `Money out of safe integer range: ${this.d.toString()}.`,
      );
    }
    return n;
  }

  toString(): string {
    return this.d.toString();
  }
}
