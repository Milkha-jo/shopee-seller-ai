import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import type { ApiServices } from '../src/container';
import { makeTokenUtil } from '../src/auth/token';

const token = makeTokenUtil('app-test-secret-0123456789', 3600);

function appWith(services: Partial<ApiServices>) {
  return buildApp({ services: services as unknown as ApiServices, token });
}

describe('app infrastructure', () => {
  it('GET /health returns ok', async () => {
    const res = await request(appWith({})).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('unknown routes return 404 NOT_FOUND', async () => {
    const res = await request(appWith({})).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('malformed JSON bodies return 400 BAD_REQUEST', async () => {
    const res = await request(appWith({}))
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{ this is not json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('unexpected (non-HttpError) failures become 500 INTERNAL', async () => {
    const app = appWith({
      auth: {
        register: async () => {
          throw new Error('boom');
        },
        getUser: async () => {
          throw new Error('unused');
        },
      } as unknown as ApiServices['auth'],
    });
    const res = await request(app).post('/api/auth/register').send({ email: 'a@toko.id' });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
  });
});
