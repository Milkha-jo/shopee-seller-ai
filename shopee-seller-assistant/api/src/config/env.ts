export interface AppConfig {
  readonly databaseUrl: string;
  readonly port: number;
  readonly authSecret: string;
  readonly authTokenTtlSeconds: number;
}

function parsePositiveInt(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
}

/**
 * Build a validated config from an environment map. Throws a clear error when a
 * required variable is missing or malformed. Pure: the env map is injected so
 * it is fully testable.
 */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  const authSecret = env.AUTH_SECRET;
  if (!authSecret || authSecret.length < 16) {
    throw new Error('AUTH_SECRET is required and must be at least 16 characters');
  }
  const port = env.PORT === undefined ? 3000 : parsePositiveInt(env.PORT, 'PORT');
  const authTokenTtlSeconds =
    env.AUTH_TOKEN_TTL === undefined ? 3600 : parsePositiveInt(env.AUTH_TOKEN_TTL, 'AUTH_TOKEN_TTL');

  return { databaseUrl, port, authSecret, authTokenTtlSeconds };
}
