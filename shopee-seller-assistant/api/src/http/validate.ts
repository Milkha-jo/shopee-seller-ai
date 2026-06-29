import {
  type CostInputs,
  type DiscountInput,
  DiscountType,
  FeeType,
  Money,
  Rate,
  RecommendationMode,
  SellerTier,
} from '@core/types';
import type { ProfitRequest, NewFeeProfileVersion, NewFeeRule } from '@svc/types';
import type { BreakEvenRequest, RecommendRequest } from '@svc/PricingService';
import { badRequest } from './errors';

interface Issue {
  field: string;
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;
const FEE_TYPES = Object.values(FeeType) as string[];
const TIERS = Object.values(SellerTier) as string[];

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}

function fail(issues: Issue[]): never {
  throw badRequest('VALIDATION_ERROR', 'request validation failed', issues);
}

// --- field getters (collect issues, return a placeholder on failure) ---

function getString(o: Record<string, unknown>, key: string, issues: Issue[], label = key): string {
  const v = o[key];
  if (typeof v !== 'string' || v.trim() === '') {
    issues.push({ field: label, message: 'must be a non-empty string' });
    return '';
  }
  return v;
}

function getEmail(o: Record<string, unknown>, issues: Issue[]): string {
  const v = o.email;
  if (typeof v !== 'string' || !EMAIL_RE.test(v)) {
    issues.push({ field: 'email', message: 'must be a valid email address' });
    return '';
  }
  return v;
}

function getIsoDate(o: Record<string, unknown>, key: string, issues: Issue[], label = key): string {
  const v = o[key];
  if (typeof v !== 'string' || !DATE_RE.test(v)) {
    issues.push({ field: label, message: 'must be a date in YYYY-MM-DD format' });
    return '';
  }
  return v;
}

function getNullableIsoDate(o: Record<string, unknown>, key: string, issues: Issue[]): string | null {
  const v = o[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || !DATE_RE.test(v)) {
    issues.push({ field: key, message: 'must be a date in YYYY-MM-DD format or null' });
    return null;
  }
  return v;
}

function getEnum(o: Record<string, unknown>, key: string, allowed: string[], issues: Issue[], label = key): string {
  const v = o[key];
  if (typeof v !== 'string' || !allowed.includes(v)) {
    issues.push({ field: label, message: `must be one of: ${allowed.join(', ')}` });
    return allowed[0] as string;
  }
  return v;
}

function getMoney(o: Record<string, unknown>, key: string, issues: Issue[], label = key): Money {
  const v = o[key];
  if (typeof v !== 'number' && typeof v !== 'string') {
    issues.push({ field: label, message: 'must be a number or numeric string' });
    return Money.zero();
  }
  try {
    return Money.fromRupiah(v);
  } catch {
    issues.push({ field: label, message: 'must be a valid rupiah amount' });
    return Money.zero();
  }
}

function getNullableMoney(o: Record<string, unknown>, key: string, issues: Issue[], label = key): Money | null {
  const v = o[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' && typeof v !== 'string') {
    issues.push({ field: label, message: 'must be a number, numeric string, or null' });
    return null;
  }
  try {
    return Money.fromRupiah(v);
  } catch {
    issues.push({ field: label, message: 'must be a valid rupiah amount or null' });
    return null;
  }
}

function getRate(o: Record<string, unknown>, key: string, issues: Issue[], label = key): Rate {
  const v = o[key];
  if (typeof v !== 'number' && typeof v !== 'string') {
    issues.push({ field: label, message: 'must be a number or numeric string' });
    return Rate.of('0');
  }
  try {
    return Rate.of(String(v));
  } catch {
    issues.push({ field: label, message: 'must be a valid rate' });
    return Rate.of('0');
  }
}

// --- discount + rules ---

function parseDiscount(raw: unknown, issues: Issue[]): DiscountInput {
  const o = asRecord(raw);
  const type = getEnum(o, 'type', Object.values(DiscountType) as string[], issues, 'discount.type') as DiscountType;
  if (type === DiscountType.PERCENTAGE) {
    return { type, value: getRate(o, 'value', issues, 'discount.value') };
  }
  if (type === DiscountType.FLAT) {
    return { type, value: getMoney(o, 'value', issues, 'discount.value') };
  }
  return { type: DiscountType.NONE, value: null };
}

function parseRules(raw: unknown, issues: Issue[]): NewFeeRule[] {
  if (!Array.isArray(raw)) {
    issues.push({ field: 'rules', message: 'must be an array' });
    return [];
  }
  return raw.map((item, i) => {
    const o = asRecord(item);
    const feeType = getEnum(o, 'feeType', FEE_TYPES, issues, `rules[${i}].feeType`) as FeeType;
    const rate = getRate(o, 'rate', issues, `rules[${i}].rate`);
    const cap = getNullableMoney(o, 'cap', issues, `rules[${i}].cap`);
    return { feeType, rate, cap };
  });
}

// --- public parsers ---

export function parseRegisterBody(body: unknown): { email: string } {
  const issues: Issue[] = [];
  const email = getEmail(asRecord(body), issues);
  if (issues.length) fail(issues);
  return { email };
}

export function parseSellerBody(body: unknown): {
  storeName: string;
  marketplace: string;
  sellerTier: SellerTier;
} {
  const o = asRecord(body);
  const issues: Issue[] = [];
  const storeName = getString(o, 'storeName', issues);
  const marketplace = getEnum(o, 'marketplace', ['SHOPEE'], issues);
  const sellerTier = getEnum(o, 'sellerTier', TIERS, issues) as SellerTier;
  if (issues.length) fail(issues);
  return { storeName, marketplace, sellerTier };
}

export function parseProfitBody(body: unknown): ProfitRequest {
  const o = asRecord(body);
  const issues: Issue[] = [];
  const sellerProfileId = getString(o, 'sellerProfileId', issues);
  const asOfDate = getIsoDate(o, 'asOfDate', issues);
  const sellingPrice = getMoney(o, 'sellingPrice', issues);
  const cost = asRecord(o.costInputs);
  const costInputs: CostInputs = {
    productCost: getMoney(cost, 'productCost', issues, 'costInputs.productCost'),
    packagingCost: getMoney(cost, 'packagingCost', issues, 'costInputs.packagingCost'),
  };
  const discount = parseDiscount(o.discount, issues);
  if (issues.length) fail(issues);
  return { sellerProfileId, asOfDate, sellingPrice, costInputs, discount };
}

function parseCostInputs(raw: unknown, issues: Issue[]): CostInputs {
  const cost = asRecord(raw);
  return {
    productCost: getMoney(cost, 'productCost', issues, 'costInputs.productCost'),
    packagingCost: getMoney(cost, 'packagingCost', issues, 'costInputs.packagingCost'),
  };
}

export function parseBreakEvenBody(body: unknown): BreakEvenRequest {
  const o = asRecord(body);
  const issues: Issue[] = [];
  const sellerProfileId = getString(o, 'sellerProfileId', issues);
  const asOfDate = getIsoDate(o, 'asOfDate', issues);
  const costInputs = parseCostInputs(o.costInputs, issues);
  if (issues.length) fail(issues);
  return { sellerProfileId, asOfDate, costInputs };
}

export function parseRecommendBody(body: unknown): RecommendRequest {
  const o = asRecord(body);
  const issues: Issue[] = [];
  const sellerProfileId = getString(o, 'sellerProfileId', issues);
  const asOfDate = getIsoDate(o, 'asOfDate', issues);
  const mode = getEnum(
    o,
    'mode',
    Object.values(RecommendationMode) as string[],
    issues,
  ) as RecommendationMode;
  const costInputs = parseCostInputs(o.costInputs, issues);

  // Optional, mode-specific targets. The frozen core enforces which target a
  // given mode requires; the API only parses what is present and well-typed.
  const req: {
    sellerProfileId: string;
    asOfDate: string;
    mode: RecommendationMode;
    costInputs: CostInputs;
    targetProfit?: Money;
    targetMargin?: Rate;
    targetMarkup?: Rate;
    safetyBuffer?: Rate;
    plannedDiscount?: DiscountInput;
  } = { sellerProfileId, asOfDate, mode, costInputs };

  if (o.targetProfit !== undefined && o.targetProfit !== null) {
    req.targetProfit = getMoney(o, 'targetProfit', issues);
  }
  if (o.targetMargin !== undefined && o.targetMargin !== null) {
    req.targetMargin = getRate(o, 'targetMargin', issues);
  }
  if (o.targetMarkup !== undefined && o.targetMarkup !== null) {
    req.targetMarkup = getRate(o, 'targetMarkup', issues);
  }
  if (o.safetyBuffer !== undefined && o.safetyBuffer !== null) {
    req.safetyBuffer = getRate(o, 'safetyBuffer', issues);
  }
  if (o.discount !== undefined && o.discount !== null) {
    req.plannedDiscount = parseDiscount(o.discount, issues);
  }

  if (issues.length) fail(issues);
  return req;
}

export function parseAsOfDate(raw: unknown): string {  const issues: Issue[] = [];
  const asOf = getIsoDate({ asOf: raw }, 'asOf', issues);
  if (issues.length) fail(issues);
  return asOf;
}

/** Parse a new version; `sellerProfileId` is supplied by the caller (route param
 *  for create, request body for replace). */
export function parseVersionBody(body: unknown, sellerProfileId: string): NewFeeProfileVersion {
  const o = asRecord(body);
  const issues: Issue[] = [];
  const effectiveDate = getIsoDate(o, 'effectiveDate', issues);
  const endDate = getNullableIsoDate(o, 'endDate', issues);
  const sourceReference = getString(o, 'sourceReference', issues);
  const rules = parseRules(o.rules, issues);
  if (issues.length) fail(issues);
  return { sellerProfileId, effectiveDate, endDate, sourceReference, rules };
}

/** For replace (PUT): the seller id is part of the body. */
export function parseSellerProfileId(body: unknown): string {
  const issues: Issue[] = [];
  const id = getString(asRecord(body), 'sellerProfileId', issues);
  if (issues.length) fail(issues);
  return id;
}
