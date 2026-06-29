import {
  type CalcError,
  InvariantViolationError,
  inputValidation,
  invalidCap,
  invalidRate,
} from '@core/errors';

interface PgError {
  code?: string;
  constraint?: string;
  column?: string;
  detail?: string;
  message?: string;
}

// Translate a known/expected PostgreSQL integrity failure into a CalcError.
// Unexpected failures (connectivity, syntax, anything without a recognised
// SQLSTATE) are not representable in the taxonomy and are treated as broken
// invariants of the persistence layer -> they throw. No raw pg error escapes.
export function mapDbError(e: unknown): CalcError {
  const pg = (e ?? {}) as PgError;
  const field = fieldFromConstraint(pg.constraint);

  switch (pg.code) {
    case '23505': // unique_violation
      return inputValidation(field ?? 'value', 'must be unique (already exists)');
    case '23503': // foreign_key_violation
      return inputValidation(field ?? 'reference', 'referenced record does not exist');
    case '23502': // not_null_violation
      return inputValidation(pg.column ?? 'value', 'is required');
    case '23514': // check_violation
      if (pg.constraint?.includes('rate')) return invalidRate('UNKNOWN', pg.constraint);
      if (pg.constraint?.includes('cap')) return invalidCap('UNKNOWN', pg.constraint);
      return inputValidation(field ?? 'value', 'violates a check constraint');
    case '22P02': // invalid_text_representation (bad enum / uuid)
      return inputValidation('value', 'has an invalid format');
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return inputValidation('date', 'is not a valid date');
    default:
      throw new InvariantViolationError(
        `unexpected database error${pg.code ? ` [${pg.code}]` : ''}: ${
          pg.message ?? String(e)
        }`,
      );
  }
}

// Best-effort constraint-name -> field label. Falls back to the constraint name.
function fieldFromConstraint(constraint?: string): string | undefined {
  if (!constraint) return undefined;
  const known: Record<string, string> = {
    users_email_key: 'email',
    users_email_format_chk: 'email',
    seller_profiles_user_id_fkey: 'user_id',
    seller_profiles_store_name_chk: 'store_name',
    seller_profiles_marketplace_chk: 'marketplace',
    fee_profiles_seller_profile_id_fkey: 'seller_profile_id',
    fee_profiles_window_chk: 'end_date',
    fee_rules_fee_profile_id_fkey: 'fee_profile_id',
    fee_rules_one_per_type: 'fee_type',
  };
  return known[constraint] ?? constraint;
}
