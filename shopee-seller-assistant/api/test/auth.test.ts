import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { authHeader, registerUser, useApi } from './setup/harness';

const api = useApi();

describe('auth endpoints', () => {
  it('POST /api/auth/register returns a user and token', async () => {
    const res = await request(api.app()).post('/api/auth/register').send({ email: 'a@toko.id' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('a@toko.id');
    expect(typeof res.body.data.token).toBe('string');
  });

  it('rejects an invalid email (400 VALIDATION_ERROR)', async () => {
    const res = await request(api.app()).post('/api/auth/register').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate email (400 from the service)', async () => {
    await request(api.app()).post('/api/auth/register').send({ email: 'dup@toko.id' });
    const res = await request(api.app()).post('/api/auth/register').send({ email: 'dup@toko.id' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INPUT_VALIDATION');
  });

  it('GET /api/auth/me requires a token (401)', async () => {
    expect((await request(api.app()).get('/api/auth/me')).status).toBe(401);
  });

  it('GET /api/auth/me rejects an invalid token (401)', async () => {
    const res = await request(api.app()).get('/api/auth/me').set(authHeader('a.b.c'));
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns the current user (200)', async () => {
    const { token, user } = await registerUser(api.app());
    const res = await request(api.app()).get('/api/auth/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
  });

  it('GET /api/auth/me returns 404 when the user no longer exists', async () => {
    const { token } = await registerUser(api.app());
    await api.container().pool.query('truncate users cascade');
    const res = await request(api.app()).get('/api/auth/me').set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
