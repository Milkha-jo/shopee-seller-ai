import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isErr, isOk, unwrap, unwrapErr } from '@core/errors';
import { makeTokenUtil } from '../src/auth/token';

const SECRET = 'unit-test-secret-0123456789';
const b64url = (b: Buffer) => b.toString('base64url');
const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
const sign = (body: string) => b64url(createHmac('sha256', SECRET).update(`${header}.${body}`).digest());

describe('makeTokenUtil', () => {
  it('signs and verifies a round-trip token', () => {
    const t = makeTokenUtil(SECRET, 3600);
    const token = t.sign('user-1');
    const payload = unwrap(t.verify(token));
    expect(payload.sub).toBe('user-1');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('rejects a token without three segments (MALFORMED)', () => {
    const t = makeTokenUtil(SECRET, 3600);
    expect(unwrapErr(t.verify('a.b')).code).toBe('MALFORMED');
  });

  it('rejects a tampered payload (BAD_SIGNATURE)', () => {
    const t = makeTokenUtil(SECRET, 3600);
    const [h, , s] = t.sign('user-1').split('.');
    const forged = `${h}.${b64url(Buffer.from(JSON.stringify({ sub: 'evil', iat: 1, exp: 9_999_999_999 })))}.${s}`;
    expect(unwrapErr(t.verify(forged)).code).toBe('BAD_SIGNATURE');
  });

  it('rejects a signature of different length (BAD_SIGNATURE)', () => {
    const t = makeTokenUtil(SECRET, 3600);
    const [h, b] = t.sign('user-1').split('.');
    expect(unwrapErr(t.verify(`${h}.${b}.short`)).code).toBe('BAD_SIGNATURE');
  });

  it('rejects a validly-signed but non-JSON payload (MALFORMED)', () => {
    const t = makeTokenUtil(SECRET, 3600);
    const body = b64url(Buffer.from('not-json'));
    const token = `${header}.${body}.${sign(body)}`;
    expect(unwrapErr(t.verify(token)).code).toBe('MALFORMED');
  });

  it('rejects a payload without a numeric exp (EXPIRED)', () => {
    const t = makeTokenUtil(SECRET, 3600);
    const body = b64url(Buffer.from(JSON.stringify({ sub: 'x' })));
    const token = `${header}.${body}.${sign(body)}`;
    expect(unwrapErr(t.verify(token)).code).toBe('EXPIRED');
  });

  it('rejects an expired token (EXPIRED) using an injected clock', () => {
    let nowMs = 1_000_000_000;
    const t = makeTokenUtil(SECRET, 60, () => nowMs);
    const token = t.sign('user-1');
    expect(isOk(t.verify(token))).toBe(true);
    nowMs += 61_000;
    expect(isErr(t.verify(token))).toBe(true);
    expect(unwrapErr(t.verify(token)).code).toBe('EXPIRED');
  });
});
