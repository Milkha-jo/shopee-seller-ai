import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { STANDARD_VERSION, authHeader, makeSeller, registerUser, useApi } from './setup/harness';

const api = useApi();

const profitBody = (sellerProfileId: string) => ({
  sellerProfileId,
  asOfDate: '2026-06-01',
  sellingPrice: 100000,
  costInputs: { productCost: 45000, packagingCost: 3000 },
  discount: { type: 'NONE', value: null },
});

describe('calculation endpoint', () => {
  it('requires authentication (401)', async () => {
    expect((await request(api.app()).post('/api/calculations/profit').send({})).status).toBe(401);
  });

  it('computes profit end-to-end (golden fixture F1)', async () => {
    const { token } = await registerUser(api.app());
    const sellerId = await makeSeller(api.app(), token);
    await request(api.app())
      .post(`/api/sellers/${sellerId}/fee-profiles`)
      .set(authHeader(token))
      .send(STANDARD_VERSION);

    const res = await request(api.app())
      .post('/api/calculations/profit')
      .set(authHeader(token))
      .send(profitBody(sellerId));
    expect(res.status).toBe(200);
    expect(res.body.data.netProfit).toBe('44000');
    expect(res.body.data.totalFees).toBe('8000');
    expect(res.body.data.marginPct).toBe('0.44');
    expect(res.body.data.feeLines).toHaveLength(3);
  });

  it('rejects an invalid body (400)', async () => {
    const { token } = await registerUser(api.app());
    const res = await request(api.app())
      .post('/api/calculations/profit')
      .set(authHeader(token))
      .send({ sellerProfileId: 's', asOfDate: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('surfaces a service error when no fee profile exists (400)', async () => {
    const { token } = await registerUser(api.app());
    const sellerId = await makeSeller(api.app(), token);
    const res = await request(api.app())
      .post('/api/calculations/profit')
      .set(authHeader(token))
      .send(profitBody(sellerId));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INPUT_VALIDATION');
  });
});

const costInputs = { productCost: 45000, packagingCost: 3000 };

async function seedSeller(): Promise<{ token: string; sellerId: string }> {
  const { token } = await registerUser(api.app());
  const sellerId = await makeSeller(api.app(), token);
  await request(api.app())
    .post(`/api/sellers/${sellerId}/fee-profiles`)
    .set(authHeader(token))
    .send(STANDARD_VERSION);
  return { token, sellerId };
}

describe('break-even endpoint', () => {
  it('requires authentication (401)', async () => {
    expect(
      (await request(api.app()).post('/api/calculations/break-even').send({})).status,
    ).toBe(401);
  });

  it('solves the break-even price end-to-end', async () => {
    const { token, sellerId } = await seedSeller();
    const res = await request(api.app())
      .post('/api/calculations/break-even')
      .set(authHeader(token))
      .send({ sellerProfileId: sellerId, asOfDate: '2026-06-01', costInputs });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OK');
    expect(Number(res.body.data.price)).toBeGreaterThan(48000);
    expect(Array.isArray(res.body.data.bindingCaps)).toBe(true);
  });

  it('rejects an invalid body (400)', async () => {
    const { token } = await registerUser(api.app());
    const res = await request(api.app())
      .post('/api/calculations/break-even')
      .set(authHeader(token))
      .send({ sellerProfileId: 's', asOfDate: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('recommend endpoint', () => {
  it('requires authentication (401)', async () => {
    expect(
      (await request(api.app()).post('/api/calculations/recommend').send({})).status,
    ).toBe(401);
  });

  it('recommends a price for TARGET_PROFIT and round-trips it', async () => {
    const { token, sellerId } = await seedSeller();
    const res = await request(api.app())
      .post('/api/calculations/recommend')
      .set(authHeader(token))
      .send({
        sellerProfileId: sellerId,
        asOfDate: '2026-06-01',
        mode: 'TARGET_PROFIT',
        costInputs,
        targetProfit: 20000,
        discount: { type: 'NONE', value: null },
      });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OK');
    expect(res.body.data.recommendedPrice).not.toBeNull();
    expect(res.body.data.roundTrip).not.toBeNull();
    expect(Number(res.body.data.breakEvenFloor)).toBeGreaterThan(48000);
    expect(
      Math.abs(Number(res.body.data.roundTrip.netProfit) - 20000),
    ).toBeLessThanOrEqual(2);
  });

  it('reports INFEASIBLE_CEILING for an impossible TARGET_MARGIN', async () => {
    const { token, sellerId } = await seedSeller();
    const res = await request(api.app())
      .post('/api/calculations/recommend')
      .set(authHeader(token))
      .send({
        sellerProfileId: sellerId,
        asOfDate: '2026-06-01',
        mode: 'TARGET_MARGIN',
        costInputs,
        targetMargin: '0.99',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.feasibility).toBe('INFEASIBLE_CEILING');
    expect(res.body.data.recommendedPrice).toBeNull();
    expect(res.body.data.ceiling).not.toBeNull();
  });

  it('rejects an invalid mode (400)', async () => {
    const { token } = await registerUser(api.app());
    const res = await request(api.app())
      .post('/api/calculations/recommend')
      .set(authHeader(token))
      .send({ sellerProfileId: 's', asOfDate: '2026-06-01', mode: 'BOGUS', costInputs });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
