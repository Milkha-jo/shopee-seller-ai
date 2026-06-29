import { describe, expect, it } from 'vitest';
import { DiscountType, FeeType, SellerTier } from '@core/types';
import { HttpError } from '../src/http/errors';
import {
  parseAsOfDate,
  parseProfitBody,
  parseRegisterBody,
  parseSellerBody,
  parseSellerProfileId,
  parseVersionBody,
} from '../src/http/validate';

function caught(fn: () => unknown): HttpError {
  try {
    fn();
  } catch (e) {
    if (e instanceof HttpError) return e;
    throw e;
  }
  throw new Error('expected a thrown HttpError');
}
const fields = (e: HttpError) => (e.details as { field: string }[]).map((d) => d.field);

describe('parseRegisterBody', () => {
  it('accepts a valid email', () => {
    expect(parseRegisterBody({ email: 'a@toko.id' })).toEqual({ email: 'a@toko.id' });
  });
  it('rejects a bad email and a non-object body', () => {
    expect(caught(() => parseRegisterBody({ email: 'nope' })).status).toBe(400);
    expect(fields(caught(() => parseRegisterBody('x')))).toContain('email');
  });
});

describe('parseSellerBody', () => {
  it('accepts a valid store', () => {
    expect(parseSellerBody({ storeName: 'Toko', marketplace: 'SHOPEE', sellerTier: 'MALL' })).toEqual({
      storeName: 'Toko',
      marketplace: 'SHOPEE',
      sellerTier: SellerTier.MALL,
    });
  });
  it('collects errors for each bad field', () => {
    const e = caught(() => parseSellerBody({ storeName: '', marketplace: 'X', sellerTier: 'NOPE' }));
    expect(fields(e).sort()).toEqual(['marketplace', 'sellerTier', 'storeName']);
  });
});

describe('parseProfitBody', () => {
  const ok = {
    sellerProfileId: 's1',
    asOfDate: '2026-06-01',
    sellingPrice: 100000,
    costInputs: { productCost: '45000', packagingCost: 3000 },
    discount: { type: 'NONE', value: null },
  };
  it('parses a valid request into domain objects', () => {
    const r = parseProfitBody(ok);
    expect(r.sellingPrice.toNumber()).toBe(100000);
    expect(r.costInputs.productCost.toNumber()).toBe(45000);
    expect(r.discount.type).toBe(DiscountType.NONE);
  });
  it('parses a PERCENTAGE discount (rate)', () => {
    const r = parseProfitBody({ ...ok, discount: { type: 'PERCENTAGE', value: '0.1' } });
    expect(r.discount.type).toBe(DiscountType.PERCENTAGE);
  });
  it('parses a FLAT discount (money)', () => {
    const r = parseProfitBody({ ...ok, discount: { type: 'FLAT', value: 5000 } });
    expect(r.discount.type).toBe(DiscountType.FLAT);
  });
  it('reports missing/invalid scalar fields', () => {
    const e = caught(() => parseProfitBody({ ...ok, sellerProfileId: 1, asOfDate: 'xx', sellingPrice: true }));
    expect(fields(e)).toEqual(expect.arrayContaining(['sellerProfileId', 'asOfDate', 'sellingPrice']));
  });
  it('reports an unparseable numeric money string', () => {
    expect(caught(() => parseProfitBody({ ...ok, sellingPrice: 'abc' })).status).toBe(400);
  });
  it('reports missing costInputs', () => {
    const e = caught(() => parseProfitBody({ ...ok, costInputs: undefined }));
    expect(fields(e)).toEqual(expect.arrayContaining(['costInputs.productCost', 'costInputs.packagingCost']));
  });
  it('reports an invalid discount type and bad rate/money values', () => {
    expect(caught(() => parseProfitBody({ ...ok, discount: { type: 'WAT', value: 1 } })).status).toBe(400);
    expect(caught(() => parseProfitBody({ ...ok, discount: { type: 'PERCENTAGE', value: 'abc' } })).status).toBe(400);
    expect(caught(() => parseProfitBody({ ...ok, discount: { type: 'PERCENTAGE', value: true } })).status).toBe(400);
    expect(caught(() => parseProfitBody({ ...ok, discount: { type: 'FLAT', value: true } })).status).toBe(400);
  });
});

describe('parseAsOfDate', () => {
  it('accepts a valid date and rejects others', () => {
    expect(parseAsOfDate('2026-01-01')).toBe('2026-01-01');
    expect(caught(() => parseAsOfDate('nope')).status).toBe(400);
    expect(caught(() => parseAsOfDate(undefined)).status).toBe(400);
  });
});

describe('parseVersionBody', () => {
  const rules = [
    { feeType: 'ADMIN', rate: '0.02', cap: 10000 },
    { feeType: 'SERVICE', rate: 0.04, cap: null },
  ];
  it('parses a valid version (with provided sellerProfileId)', () => {
    const v = parseVersionBody({ effectiveDate: '2026-01-01', endDate: null, sourceReference: 'src', rules }, 's1');
    expect(v.sellerProfileId).toBe('s1');
    expect(v.rules).toHaveLength(2);
    expect(v.rules[0]!.feeType).toBe(FeeType.ADMIN);
    expect(v.rules[1]!.cap).toBeNull();
  });
  it('accepts a bounded endDate', () => {
    const v = parseVersionBody({ effectiveDate: '2026-01-01', endDate: '2026-03-31', sourceReference: 'src', rules }, 's1');
    expect(v.endDate).toBe('2026-03-31');
  });
  it('reports bad scalar fields and a non-array rules', () => {
    const e = caught(() =>
      parseVersionBody({ effectiveDate: 'x', endDate: 5, sourceReference: '', rules: 'no' }, 's1'),
    );
    expect(fields(e)).toEqual(expect.arrayContaining(['effectiveDate', 'endDate', 'sourceReference', 'rules']));
  });
  it('reports per-rule errors (feeType, rate type, rate parse, cap type, cap parse)', () => {
    const bad = [
      { feeType: 'NOPE', rate: '0.02', cap: null },
      { feeType: 'ADMIN', rate: true, cap: null },
      { feeType: 'ADMIN', rate: 'abc', cap: null },
      { feeType: 'ADMIN', rate: '0.02', cap: true },
      { feeType: 'ADMIN', rate: '0.02', cap: 'abc' },
    ];
    const e = caught(() => parseVersionBody({ effectiveDate: '2026-01-01', endDate: null, sourceReference: 'src', rules: bad }, 's1'));
    expect(fields(e)).toEqual(
      expect.arrayContaining([
        'rules[0].feeType',
        'rules[1].rate',
        'rules[2].rate',
        'rules[3].cap',
        'rules[4].cap',
      ]),
    );
  });
});

describe('parseSellerProfileId', () => {
  it('accepts a present id, rejects a missing one', () => {
    expect(parseSellerProfileId({ sellerProfileId: 's1' })).toBe('s1');
    expect(caught(() => parseSellerProfileId({})).status).toBe(400);
  });
});
