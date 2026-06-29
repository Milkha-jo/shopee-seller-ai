import { InvariantViolationError } from './invariant';
import type { CalcError } from './taxonomy';

/**
 * Result pattern: every fallible operation returns a Result instead of throwing.
 * `ok` carries a success value; `err` carries a typed, returnable error.
 *
 * `E` defaults to `CalcError` so the common case needs no second type argument.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = CalcError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;

export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

/**
 * Extracts the success value. Intended for tests and internal call sites that
 * have already proven success. Calling it on an `Err` is a programmer error,
 * so it throws an InvariantViolationError (never a returnable error).
 */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new InvariantViolationError(
    `unwrap() called on Err: ${safeStringify(r.error)}`,
  );
}

/** Mirror of `unwrap` for the error channel. */
export function unwrapErr<T, E>(r: Result<T, E>): E {
  if (!r.ok) return r.error;
  throw new InvariantViolationError(
    `unwrapErr() called on Ok: ${safeStringify((r as Ok<T>).value)}`,
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
