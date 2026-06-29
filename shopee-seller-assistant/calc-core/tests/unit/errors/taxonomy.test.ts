import { describe, expect, it } from 'vitest';
import {
  type CalcError,
  describeError,
  inputValidation,
  invalidCap,
  invalidRate,
  missingFeeType,
  noEffectiveFee,
  overlappingFeeWindow,
  unsupportedFeeType,
} from '../../../src/errors';

describe('error taxonomy factories', () => {
  it('build correctly tagged, serializable objects', () => {
    expect(inputValidation('sellingPrice', 'must be > 0')).toEqual({
      kind: 'INPUT_VALIDATION',
      field: 'sellingPrice',
      rule: 'must be > 0',
    });
    expect(missingFeeType('PAYMENT')).toEqual({
      kind: 'MISSING_FEE_TYPE',
      feeType: 'PAYMENT',
    });
    expect(overlappingFeeWindow('ADMIN')).toEqual({
      kind: 'OVERLAPPING_FEE_WINDOW',
      feeType: 'ADMIN',
    });
    expect(noEffectiveFee('SERVICE', '2026-06-25')).toEqual({
      kind: 'NO_EFFECTIVE_FEE',
      feeType: 'SERVICE',
      date: '2026-06-25',
    });
    expect(unsupportedFeeType('FLAT_THING')).toEqual({
      kind: 'UNSUPPORTED_FEE_TYPE',
      feeType: 'FLAT_THING',
    });
    expect(invalidRate('ADMIN', '1.5')).toEqual({
      kind: 'INVALID_RATE',
      feeType: 'ADMIN',
      value: '1.5',
    });
    expect(invalidCap('ADMIN', '-1')).toEqual({
      kind: 'INVALID_CAP',
      feeType: 'ADMIN',
      value: '-1',
    });
  });

  it('describeError covers every kind', () => {
    const samples: CalcError[] = [
      inputValidation('f', 'r'),
      missingFeeType('PAYMENT'),
      overlappingFeeWindow('ADMIN'),
      noEffectiveFee('SERVICE', '2026-06-25'),
      unsupportedFeeType('X'),
      invalidRate('ADMIN', '2'),
      invalidCap('ADMIN', '-1'),
    ];
    for (const e of samples) {
      const msg = describeError(e);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('errors round-trip through JSON (are pure data)', () => {
    const e = missingFeeType('PAYMENT');
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  });
});
