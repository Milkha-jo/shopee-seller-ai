import { describe, expect, it } from 'vitest';
import { InvariantViolationError } from '@core/errors';
import { mapDbError } from '../src/db/mapError';

const pg = (code: string, extra: Record<string, unknown> = {}) => ({ code, ...extra });

describe('mapDbError — SQLSTATE → CalcError', () => {
  it('23505 unique_violation → INPUT_VALIDATION with mapped field', () => {
    const e = mapDbError(pg('23505', { constraint: 'users_email_key' }));
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('email');
  });

  it('23505 with unknown constraint falls back to the constraint name', () => {
    const e = mapDbError(pg('23505', { constraint: 'weird_uq' }));
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('weird_uq');
  });

  it('23505 with no constraint falls back to "value"', () => {
    const e = mapDbError(pg('23505'));
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('value');
  });

  it('23503 foreign_key_violation → INPUT_VALIDATION(reference field)', () => {
    const e = mapDbError(pg('23503', { constraint: 'fee_rules_fee_profile_id_fkey' }));
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('fee_profile_id');
  });

  it('23503 with no constraint → field "reference"', () => {
    const e = mapDbError(pg('23503'));
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('reference');
  });

  it('23502 not_null_violation → INPUT_VALIDATION(column)', () => {
    const e = mapDbError(pg('23502', { column: 'email' }));
    if (e.kind === 'INPUT_VALIDATION') {
      expect(e.field).toBe('email');
      expect(e.rule).toContain('required');
    }
  });

  it('23502 with no column → "value"', () => {
    const e = mapDbError(pg('23502'));
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('value');
  });

  it('23514 check on rate → INVALID_RATE', () => {
    expect(mapDbError(pg('23514', { constraint: 'fee_rules_rate_chk' })).kind).toBe('INVALID_RATE');
  });

  it('23514 check on cap → INVALID_CAP', () => {
    expect(mapDbError(pg('23514', { constraint: 'fee_rules_cap_chk' })).kind).toBe('INVALID_CAP');
  });

  it('23514 other check → INPUT_VALIDATION', () => {
    const e = mapDbError(pg('23514', { constraint: 'seller_profiles_marketplace_chk' }));
    expect(e.kind).toBe('INPUT_VALIDATION');
  });

  it('23514 with no constraint → INPUT_VALIDATION(value)', () => {
    const e = mapDbError(pg('23514'));
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('value');
  });

  it('22P02 invalid enum/uuid → INPUT_VALIDATION', () => {
    expect(mapDbError(pg('22P02')).kind).toBe('INPUT_VALIDATION');
  });

  it('22007 / 22008 invalid datetime → INPUT_VALIDATION(date)', () => {
    expect(mapDbError(pg('22007')).kind).toBe('INPUT_VALIDATION');
    const e = mapDbError(pg('22008'));
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('date');
  });

  it('unknown SQLSTATE → throws InvariantViolationError', () => {
    expect(() => mapDbError(pg('08006', { message: 'connection failure' }))).toThrow(
      InvariantViolationError,
    );
  });

  it('non-pg / undefined error → throws InvariantViolationError', () => {
    expect(() => mapDbError(undefined)).toThrow(InvariantViolationError);
    expect(() => mapDbError(new Error('boom'))).toThrow(InvariantViolationError);
  });
});
