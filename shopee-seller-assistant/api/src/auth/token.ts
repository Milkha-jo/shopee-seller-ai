import { createHmac, timingSafeEqual } from 'node:crypto';
import { type Result, err, ok } from '@core/errors';

export interface TokenPayload {
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
}

export type TokenErrorCode = 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED';
export interface TokenError {
  readonly code: TokenErrorCode;
  readonly message: string;
}

export interface TokenUtil {
  sign(sub: string): string;
  verify(token: string): Result<TokenPayload, TokenError>;
}

const b64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Stateless HS256 bearer tokens over node:crypto. `now` is injectable so token
 * expiry is deterministic in tests. Not a full JWT library — just signed,
 * expiring identity assertions, which is all the approved auth layer requires.
 */
export function makeTokenUtil(
  secret: string,
  ttlSeconds: number,
  now: () => number = () => Date.now(),
): TokenUtil {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));

  const signature = (signingInput: string): string =>
    b64url(createHmac('sha256', secret).update(signingInput).digest());

  return {
    sign(sub: string): string {
      const iat = Math.floor(now() / 1000);
      const payload: TokenPayload = { sub, iat, exp: iat + ttlSeconds };
      const body = b64url(Buffer.from(JSON.stringify(payload)));
      const signingInput = `${header}.${body}`;
      return `${signingInput}.${signature(signingInput)}`;
    },

    verify(token: string): Result<TokenPayload, TokenError> {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return err({ code: 'MALFORMED', message: 'token must have three segments' });
      }
      const [h, body, sig] = parts as [string, string, string];
      const expected = signature(`${h}.${body}`);
      const a = fromB64url(sig);
      const b = fromB64url(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return err({ code: 'BAD_SIGNATURE', message: 'signature mismatch' });
      }
      let payload: TokenPayload;
      try {
        payload = JSON.parse(fromB64url(body).toString('utf8')) as TokenPayload;
      } catch {
        return err({ code: 'MALFORMED', message: 'payload is not valid JSON' });
      }
      if (typeof payload.exp !== 'number' || payload.exp * 1000 < now()) {
        return err({ code: 'EXPIRED', message: 'token has expired' });
      }
      return ok(payload);
    },
  };
}
