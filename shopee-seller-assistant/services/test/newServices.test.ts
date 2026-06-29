import { describe, expect, it } from 'vitest';
import { SellerTier } from '@core/types';
import { err, inputValidation, isErr, ok, unwrap } from '@core/errors';
import { AuthService } from '../src/AuthService';
import { SellerProfileService } from '../src/SellerProfileService';
import { sellerProfile } from './setup/fakes';

const user = { id: 'u1', email: 'a@toko.id', createdAt: 'C' };

describe('AuthService', () => {
  it('register forwards to the user store (success)', async () => {
    const svc = new AuthService({ users: { create: async () => ok(user), getById: async () => ok(null) } });
    expect(unwrap(await svc.register('a@toko.id'))).toEqual(user);
  });

  it('register propagates a repository error', async () => {
    const svc = new AuthService({
      users: { create: async () => err(inputValidation('email', 'dup')), getById: async () => ok(null) },
    });
    expect(isErr(await svc.register('a@toko.id'))).toBe(true);
  });

  it('getUser returns the user, null, or propagates an error', async () => {
    const found = new AuthService({ users: { create: async () => ok(user), getById: async () => ok(user) } });
    expect(unwrap(await found.getUser('u1'))).toEqual(user);
    const missing = new AuthService({ users: { create: async () => ok(user), getById: async () => ok(null) } });
    expect(unwrap(await missing.getUser('x'))).toBeNull();
    const broken = new AuthService({ users: { create: async () => ok(user), getById: async () => err(inputValidation('db', 'down')) } });
    expect(isErr(await broken.getUser('x'))).toBe(true);
  });
});

describe('SellerProfileService', () => {
  const store = sellerProfile();
  const make = (over = {}) =>
    new SellerProfileService({
      sellers: {
        create: async () => ok(store),
        getById: async () => ok(store),
        list: async () => ok([store]),
        ...over,
      },
    });

  it('create / getById / list forward to the store', async () => {
    const svc = make();
    expect(unwrap(await svc.create({ userId: 'u1', storeName: 'T', marketplace: 'SHOPEE', sellerTier: SellerTier.REGULAR }))).toEqual(store);
    expect(unwrap(await svc.getById('s1'))).toEqual(store);
    expect(unwrap(await svc.list('u1'))).toEqual([store]);
  });

  it('propagates store errors', async () => {
    const svc = make({ create: async () => err(inputValidation('user_id', 'fk')) });
    expect(isErr(await svc.create({ userId: 'x', storeName: 'T', marketplace: 'SHOPEE', sellerTier: SellerTier.REGULAR }))).toBe(true);
  });
});
