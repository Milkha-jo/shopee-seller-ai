import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { STANDARD_VERSION, authHeader, makeSeller, registerUser, useApi } from './setup/harness';

const api = useApi();

async function setup() {
  const { token } = await registerUser(api.app());
  const sellerId = await makeSeller(api.app(), token);
  return { token, sellerId };
}

describe('fee-profile endpoints', () => {
  it('require authentication (401)', async () => {
    expect((await request(api.app()).delete('/api/fee-profiles/x')).status).toBe(401);
  });

  it('create a version then read it back as active', async () => {
    const { token, sellerId } = await setup();
    const create = await request(api.app())
      .post(`/api/sellers/${sellerId}/fee-profiles`)
      .set(authHeader(token))
      .send(STANDARD_VERSION);
    expect(create.status).toBe(201);
    expect(create.body.data.rules).toHaveLength(3);

    const active = await request(api.app())
      .get(`/api/sellers/${sellerId}/fee-profile?asOf=2026-06-01`)
      .set(authHeader(token));
    expect(active.status).toBe(200);
    expect(active.body.data.profile.sourceReference).toBe('shopee-id-2026');
  });

  it('returns 404 when there is no active profile', async () => {
    const { token, sellerId } = await setup();
    const res = await request(api.app())
      .get(`/api/sellers/${sellerId}/fee-profile?asOf=2026-06-01`)
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });

  it('rejects a missing/invalid asOf (400)', async () => {
    const { token, sellerId } = await setup();
    const res = await request(api.app())
      .get(`/api/sellers/${sellerId}/fee-profile`)
      .set(authHeader(token));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid version body (400)', async () => {
    const { token, sellerId } = await setup();
    const res = await request(api.app())
      .post(`/api/sellers/${sellerId}/fee-profiles`)
      .set(authHeader(token))
      .send({ effectiveDate: '2026-01-01', endDate: null, sourceReference: 'x', rules: 'no' });
    expect(res.status).toBe(400);
  });

  it('replaces a version (PUT) and deactivates it (DELETE)', async () => {
    const { token, sellerId } = await setup();
    const create = await request(api.app())
      .post(`/api/sellers/${sellerId}/fee-profiles`)
      .set(authHeader(token))
      .send(STANDARD_VERSION);
    const id = create.body.data.profile.id;

    const put = await request(api.app())
      .put(`/api/fee-profiles/${id}`)
      .set(authHeader(token))
      .send({ ...STANDARD_VERSION, sellerProfileId: sellerId, sourceReference: 'v2' });
    expect(put.status).toBe(200);
    expect(put.body.data.profile.sourceReference).toBe('v2');
    const newId = put.body.data.profile.id;

    const del = await request(api.app()).delete(`/api/fee-profiles/${newId}`).set(authHeader(token));
    expect(del.status).toBe(200);
    expect(del.body.data.deactivated).toBe(true);

    const again = await request(api.app()).delete(`/api/fee-profiles/${newId}`).set(authHeader(token));
    expect(again.status).toBe(404);
  });

  it('PUT with a missing sellerProfileId in the body (400)', async () => {
    const { token } = await setup();
    const res = await request(api.app())
      .put('/api/fee-profiles/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token))
      .send({ ...STANDARD_VERSION });
    expect(res.status).toBe(400);
  });
});
