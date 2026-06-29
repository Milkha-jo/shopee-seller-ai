import { afterAll, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { loadConfig } from '../../src/config/env';
import { buildContainer, type Container } from '../../src/container';
import { buildApp } from '../../src/app';

const AUTH_SECRET = 'integration-secret-0123456789';

export function useApi(): { app: () => Express; container: () => Container } {
  let container: Container;
  let app: Express;
  beforeAll(() => {
    const config = loadConfig({ ...process.env, AUTH_SECRET });
    container = buildContainer(config);
    app = buildApp({ services: container.services, token: container.token });
  });
  afterAll(async () => {
    await container.close();
  });
  beforeEach(async () => {
    await container.pool.query(
      'truncate users, seller_profiles, fee_profiles, fee_rules restart identity cascade',
    );
  });
  return { app: () => app, container: () => container };
}

export const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function registerUser(
  app: Express,
  email = `u${Math.random()}@toko.id`,
): Promise<{ token: string; user: { id: string; email: string } }> {
  const res = await request(app).post('/api/auth/register').send({ email });
  return { token: res.body.data.token, user: res.body.data.user };
}

export async function makeSeller(app: Express, token: string): Promise<string> {
  const res = await request(app)
    .post('/api/sellers')
    .set(authHeader(token))
    .send({ storeName: 'Toko Jaya', marketplace: 'SHOPEE', sellerTier: 'REGULAR' });
  return res.body.data.id;
}

export const STANDARD_VERSION = {
  effectiveDate: '2026-01-01',
  endDate: null,
  sourceReference: 'shopee-id-2026',
  rules: [
    { feeType: 'ADMIN', rate: '0.02', cap: 10000 },
    { feeType: 'SERVICE', rate: '0.04', cap: null },
    { feeType: 'PAYMENT', rate: '0.02', cap: null },
  ],
};
