import { describe, expect, it } from 'vitest';
import { FeeType, SellerTier } from '@core/types';
import { InvariantViolationError } from '@core/errors';
import { toFeeProfile, toFeeRule, toSellerProfile, toUser } from '../src/db/rowMappers';

describe('row mappers', () => {
  it('toUser maps snake_case → camelCase', () => {
    expect(toUser({ id: 'u1', email: 'e@x.id', created_at: 'T' })).toEqual({
      id: 'u1',
      email: 'e@x.id',
      createdAt: 'T',
    });
  });

  it('toSellerProfile preserves the seller_tier enum', () => {
    const s = toSellerProfile({
      id: 's1',
      user_id: 'u1',
      store_name: 'Toko',
      marketplace: 'SHOPEE',
      seller_tier: 'MALL',
      created_at: 'C',
      updated_at: 'U',
    });
    expect(s.sellerTier).toBe(SellerTier.MALL);
    expect(s.userId).toBe('u1');
  });

  it('toFeeProfile carries a null end_date through', () => {
    const f = toFeeProfile({
      id: 'f1',
      seller_profile_id: 's1',
      effective_date: '2026-01-01',
      end_date: null,
      source_reference: 'src',
      created_at: 'C',
    });
    expect(f.endDate).toBeNull();
    expect(f.effectiveDate).toBe('2026-01-01');
  });

  it('toFeeRule maps rate→Rate and cap→Money, null cap stays null', () => {
    const capped = toFeeRule({
      id: 'r1',
      fee_profile_id: 'f1',
      fee_type: 'ADMIN',
      rate: '0.02000',
      cap: '10000',
      created_at: 'C',
    });
    expect(capped.feeType).toBe(FeeType.ADMIN);
    expect(capped.cap?.toNumber()).toBe(10000);
    expect(capped.rate.toString()).toBe('0.02');

    const uncapped = toFeeRule({
      id: 'r2',
      fee_profile_id: 'f1',
      fee_type: 'SERVICE',
      rate: '0.04',
      cap: null,
      created_at: 'C',
    });
    expect(uncapped.cap).toBeNull();
  });

  it('toFeeRule throws on an out-of-safe-range cap (impossible invariant)', () => {
    expect(() =>
      toFeeRule({
        id: 'r3',
        fee_profile_id: 'f1',
        fee_type: 'ADMIN',
        rate: '0.02',
        cap: '9007199254740993', // 2^53 + 1
        created_at: 'C',
      }),
    ).toThrow(InvariantViolationError);
  });
});
