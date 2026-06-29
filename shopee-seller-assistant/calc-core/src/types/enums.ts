/**
 * Domain enumerations (Phase 1 Blueprint §2).
 * String-valued so their serialized form is stable and matches the
 * string-based error taxonomy.
 */

export enum SellerTier {
  REGULAR = 'REGULAR',
  STAR = 'STAR',
  STAR_PLUS = 'STAR_PLUS',
  MALL = 'MALL',
}

export enum FeeType {
  ADMIN = 'ADMIN',
  SERVICE = 'SERVICE',
  PAYMENT = 'PAYMENT',
}

export enum DiscountType {
  NONE = 'NONE',
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

export enum RecommendationMode {
  TARGET_PROFIT = 'TARGET_PROFIT',
  TARGET_MARGIN = 'TARGET_MARGIN',
  TARGET_MARKUP = 'TARGET_MARKUP',
  MIN_VIABLE = 'MIN_VIABLE',
}

export enum ResultStatus {
  OK = 'OK',
  MARGIN_UNDEFINED = 'MARGIN_UNDEFINED',
  MARKUP_UNDEFINED = 'MARKUP_UNDEFINED',
  NO_SOLUTION = 'NO_SOLUTION',
  INFEASIBLE_CEILING = 'INFEASIBLE_CEILING',
  CONFIG_ERROR = 'CONFIG_ERROR',
  INPUT_ERROR = 'INPUT_ERROR',
}
