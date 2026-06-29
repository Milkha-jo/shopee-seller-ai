import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  err,
  isErr,
  isOk,
  ok,
  unwrap,
  unwrapErr,
  type Result,
} from '../../../src/errors';

describe('Result', () => {
  it('ok() builds a success result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  it('err() builds a failure result', () => {
    const r = err('nope');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('nope');
  });

  it('isOk / isErr narrow correctly', () => {
    const a: Result<number, string> = ok(1);
    const b: Result<number, string> = err('e');
    expect(isOk(a)).toBe(true);
    expect(isErr(a)).toBe(false);
    expect(isOk(b)).toBe(false);
    expect(isErr(b)).toBe(true);
  });

  it('unwrap returns the value on Ok', () => {
    expect(unwrap(ok('v'))).toBe('v');
  });

  it('unwrap throws InvariantViolationError on Err', () => {
    expect(() => unwrap(err('bad'))).toThrow(InvariantViolationError);
  });

  it('unwrapErr returns the error on Err', () => {
    expect(unwrapErr(err('bad'))).toBe('bad');
  });

  it('unwrapErr throws InvariantViolationError on Ok', () => {
    expect(() => unwrapErr(ok(1))).toThrow(InvariantViolationError);
  });
});
