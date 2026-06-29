import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env';

const base = { DATABASE_URL: 'postgres://x', AUTH_SECRET: '0123456789abcdef0123' };

describe('loadConfig', () => {
  it('builds a config with defaults when optional vars are absent', () => {
    const c = loadConfig({ ...base });
    expect(c).toEqual({
      databaseUrl: 'postgres://x',
      authSecret: '0123456789abcdef0123',
      port: 3000,
      authTokenTtlSeconds: 3600,
    });
  });

  it('parses provided PORT and AUTH_TOKEN_TTL', () => {
    const c = loadConfig({ ...base, PORT: '8080', AUTH_TOKEN_TTL: '60' });
    expect(c.port).toBe(8080);
    expect(c.authTokenTtlSeconds).toBe(60);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({ AUTH_SECRET: base.AUTH_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('throws when AUTH_SECRET is missing or too short', () => {
    expect(() => loadConfig({ DATABASE_URL: 'x' })).toThrow(/AUTH_SECRET/);
    expect(() => loadConfig({ DATABASE_URL: 'x', AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
  });

  it('throws on a non-positive or non-integer PORT', () => {
    expect(() => loadConfig({ ...base, PORT: '0' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...base, PORT: '1.5' })).toThrow(/PORT/);
  });

  it('throws on an invalid AUTH_TOKEN_TTL', () => {
    expect(() => loadConfig({ ...base, AUTH_TOKEN_TTL: '-1' })).toThrow(/AUTH_TOKEN_TTL/);
  });
});
