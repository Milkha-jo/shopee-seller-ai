import { describe, expect, it } from 'vitest';
import {
  inputValidation,
  invalidCap,
  invalidRate,
  missingFeeType,
  noEffectiveFee,
  overlappingFeeWindow,
  unsupportedFeeType,
} from '@core/errors';
import {
  HttpError,
  badRequest,
  fromCalcError,
  notFound,
  unauthorized,
} from '../src/http/errors';

describe('HTTP error helpers', () => {
  it('badRequest carries details when provided, omits otherwise', () => {
    expect(badRequest('C', 'm').body()).toEqual({ code: 'C', message: 'm' });
    expect(badRequest('C', 'm', [1]).body()).toEqual({ code: 'C', message: 'm', details: [1] });
  });

  it('unauthorized and notFound use defaults and overrides', () => {
    expect(unauthorized().status).toBe(401);
    expect(unauthorized('nope').message).toBe('nope');
    expect(notFound().status).toBe(404);
    expect(notFound('gone').message).toBe('gone');
  });

  it('maps every CalcError kind to a 400 with a descriptive message', () => {
    const cases = [
      inputValidation('email', 'required'),
      invalidRate('ADMIN', '1.5'),
      invalidCap('ADMIN', '-1'),
      missingFeeType('SERVICE'),
      noEffectiveFee('PAYMENT', '2026-01-01'),
      overlappingFeeWindow('ADMIN'),
      unsupportedFeeType('FOO'),
    ];
    for (const e of cases) {
      const http = fromCalcError(e);
      expect(http).toBeInstanceOf(HttpError);
      expect(http.status).toBe(400);
      expect(http.code).toBe(e.kind);
      expect(http.message.length).toBeGreaterThan(0);
      expect((http.details as { kind: string }).kind).toBe(e.kind);
    }
  });
});
