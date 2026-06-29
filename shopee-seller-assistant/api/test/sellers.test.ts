import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { authHeader, registerUser, useApi } from './setup/harness';

const api = useApi();

describe('seller endpoints', () => {
  it('require authentication (401)', async () => {
    expect((await request(api.app()).get('/api/sellers')).status).toBe(401);
  });

  it('create, list and fetch a seller', async () => {
    const { token } = await registerUser(api.app());
    const create = await request(api.app())
      .post('/api/sellers')
      .set(authHeader(token))
      .send({ storeName: 'Toko', marketplace: 'SHOPEE', sellerTier: 'STAR' });
    expect(create.status).toBe(201);
    expect(create.body.data.sellerTier).toBe('STAR');
    const id = create.body.data.id;

    const list = await request(api.app()).get('/api/sellers').set(authHeader(token));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const got = await request(api.app()).get(`/api/sellers/${id}`).set(authHeader(token));
    expect(got.status).toBe(200);
    expect(got.body.data.id).toBe(id);
  });

  it('rejects an invalid seller body (400)', async () => {
    const { token } = await registerUser(api.app());
    const res = await request(api.app())
      .post('/api/sellers')
      .set(authHeader(token))
      .send({ storeName: '', marketplace: 'X', sellerTier: 'Z' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a missing seller', async () => {
    const { token } = await registerUser(api.app());
    const res = await request(api.app())
      .get('/api/sellers/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
