import { FeeType, Money, Rate, SellerTier } from '@core/types';
import { InvariantViolationError } from '@core/errors';
import type { FeeProfile, FeeRule, SellerProfile, User } from '../domain';
import type {
  FeeProfileRow,
  FeeRuleRow,
  SellerProfileRow,
  UserRow,
} from './types';

export function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export function toSellerProfile(row: SellerProfileRow): SellerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    storeName: row.store_name,
    marketplace: row.marketplace,
    sellerTier: row.seller_tier as SellerTier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toFeeProfile(row: FeeProfileRow): FeeProfile {
  return {
    id: row.id,
    sellerProfileId: row.seller_profile_id,
    effectiveDate: row.effective_date,
    endDate: row.end_date,
    sourceReference: row.source_reference,
    createdAt: row.created_at,
  };
}

export function toFeeRule(row: FeeRuleRow): FeeRule {
  // int8 caps arrive as strings; guard the (impossible) out-of-range case so a
  // corrupt cap surfaces as an invariant violation rather than silent precision loss.
  let cap: Money | null = null;
  if (row.cap !== null) {
    const n = Number(row.cap);
    if (!Number.isSafeInteger(n)) {
      throw new InvariantViolationError(
        `fee_rules.cap out of safe integer range: ${row.cap}`,
      );
    }
    cap = Money.fromRupiah(n);
  }
  return {
    id: row.id,
    feeProfileId: row.fee_profile_id,
    feeType: row.fee_type as FeeType,
    rate: Rate.of(row.rate),
    cap,
    createdAt: row.created_at,
  };
}
