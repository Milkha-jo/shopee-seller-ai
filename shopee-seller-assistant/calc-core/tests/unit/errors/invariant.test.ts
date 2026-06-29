import { describe, expect, it } from 'vitest';
import { InvariantViolationError } from '../../../src/errors';

describe('InvariantViolationError', () => {
  it('is an Error subclass with the correct name', () => {
    const e = new InvariantViolationError('boom');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(InvariantViolationError);
    expect(e.name).toBe('InvariantViolationError');
    expect(e.message).toBe('boom');
  });

  it('is catchable as itself', () => {
    const throwIt = () => {
      throw new InvariantViolationError('x');
    };
    expect(throwIt).toThrow(InvariantViolationError);
  });
});
