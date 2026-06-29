import { D, Dec } from '../money';

/**
 * A rate expressed as a decimal fraction (e.g. "0.02" = 2%).
 *
 * This is a value object only: it holds an exact decimal and exposes it.
 * It performs NO range or precision validation — confirming the fraction is
 * within [0, 1] at 4-dp precision is the responsibility of the validation
 * module, which sits above `types` in the dependency graph.
 *
 * Fractional values are passed as exact strings to keep floating point out.
 */
export class Rate {
  private readonly d: Dec;

  private constructor(d: Dec) {
    this.d = d;
  }

  /** The single constructor for the value object. */
  static of(value: string): Rate {
    return new Rate(new D(value));
  }

  /** A copy of the underlying decimal, for exact arithmetic by consumers. */
  toDecimal(): Dec {
    return new D(this.d);
  }

  toString(): string {
    return this.d.toString();
  }
}
