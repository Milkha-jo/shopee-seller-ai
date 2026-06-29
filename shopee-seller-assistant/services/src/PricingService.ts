import {
  type CalcError,
  type Result,
  err,
  inputValidation,
  isErr,
  ok,
} from '@core/errors';
import {
  type CostInputs,
  type DiscountInput,
  type FeeRateRow,
  type IsoDate,
  type Money,
  type Rate,
  type RecommendInput,
  type RecommendResult,
  type ResolvedFeeProfile,
  type SellerTier,
  RecommendationMode,
} from '@core/types';
import { resolveFeeProfile } from '@core/fees';
import {
  type BreakEvenCalculation,
  calculateBreakEven,
} from '@core/break-even';
import { recommendPrice } from '@core/recommend-price';
import type {
  ActiveFeeProfileReader,
  FeeRuleLister,
  SellerProfileReader,
} from './ports';

export interface PricingServiceDeps {
  readonly sellerProfiles: SellerProfileReader;
  readonly feeProfiles: ActiveFeeProfileReader;
  readonly feeRules: FeeRuleLister;
}

/** Break-even request: the seller + date select the active profile; costs are
 *  supplied by the caller. No pricing — break-even *is* the solved price. */
export interface BreakEvenRequest {
  readonly sellerProfileId: string;
  readonly asOfDate: IsoDate;
  readonly costInputs: CostInputs;
}

/** Recommendation request. Exactly one target field is required per mode
 *  (validated by the frozen core); the planned discount is optional. */
export interface RecommendRequest {
  readonly sellerProfileId: string;
  readonly asOfDate: IsoDate;
  readonly mode: RecommendationMode;
  readonly costInputs: CostInputs;
  readonly targetProfit?: Money;
  readonly targetMargin?: Rate;
  readonly targetMarkup?: Rate;
  readonly safetyBuffer?: Rate;
  readonly plannedDiscount?: DiscountInput;
}

/**
 * Exposes the frozen Phase 1 break-even and recommended-price engines over the
 * persistence layer. It performs NO pricing math itself: profile resolution is
 * delegated to calc-core's resolver, and the solving to `calculateBreakEven` /
 * `recommendPrice`. Mirrors `CalculationService`'s resolution sequence so the
 * same seller/profile/rules feed every engine consistently.
 */
export class PricingService {
  constructor(private readonly deps: PricingServiceDeps) {}

  async calculateBreakEven(
    req: BreakEvenRequest,
  ): Promise<Result<BreakEvenCalculation, CalcError>> {
    const resolved = await this.resolveProfile(req.sellerProfileId, req.asOfDate);
    if (isErr(resolved)) return resolved;

    const totalCost = req.costInputs.productCost.add(req.costInputs.packagingCost);
    return ok(calculateBreakEven(totalCost, resolved.value.profile));
  }

  async recommend(
    req: RecommendRequest,
  ): Promise<Result<RecommendResult, CalcError>> {
    const resolved = await this.resolveProfile(req.sellerProfileId, req.asOfDate);
    if (isErr(resolved)) return resolved;

    const input: RecommendInput = {
      mode: req.mode,
      costInputs: req.costInputs,
      sellerTier: resolved.value.sellerTier,
      asOfDate: req.asOfDate,
      profile: resolved.value.profile,
      ...(req.targetProfit !== undefined ? { targetProfit: req.targetProfit } : {}),
      ...(req.targetMargin !== undefined ? { targetMargin: req.targetMargin } : {}),
      ...(req.targetMarkup !== undefined ? { targetMarkup: req.targetMarkup } : {}),
      ...(req.safetyBuffer !== undefined ? { safetyBuffer: req.safetyBuffer } : {}),
      ...(req.plannedDiscount !== undefined
        ? { plannedDiscount: req.plannedDiscount }
        : {}),
    };
    return recommendPrice(input);
  }

  /**
   * Load seller → active fee profile → rules → resolved profile, exactly as the
   * profit path does. Returns the resolved profile plus the seller tier the
   * recommendation engine needs.
   */
  private async resolveProfile(
    sellerProfileId: string,
    asOfDate: IsoDate,
  ): Promise<Result<{ profile: ResolvedFeeProfile; sellerTier: SellerTier }, CalcError>> {
    const sellerRes = await this.deps.sellerProfiles.getById(sellerProfileId);
    if (isErr(sellerRes)) return sellerRes;
    const seller = sellerRes.value;
    if (seller === null) {
      return err(inputValidation('sellerProfileId', 'seller profile not found'));
    }

    const fpRes = await this.deps.feeProfiles.findActiveAsOfDate(
      sellerProfileId,
      asOfDate,
    );
    if (isErr(fpRes)) return fpRes;
    const feeProfile = fpRes.value;
    if (feeProfile === null) {
      return err(
        inputValidation('feeProfile', `no active fee profile as of ${asOfDate}`),
      );
    }

    const rulesRes = await this.deps.feeRules.list(feeProfile.id);
    if (isErr(rulesRes)) return rulesRes;

    const rows: FeeRateRow[] = rulesRes.value.map((rule) => ({
      feeType: rule.feeType,
      rate: rule.rate,
      cap: rule.cap,
      effectiveDate: feeProfile.effectiveDate,
      endDate: feeProfile.endDate,
      sourceRef: feeProfile.sourceReference,
    }));

    const resolvedRes = resolveFeeProfile(seller.sellerTier, asOfDate, rows);
    if (isErr(resolvedRes)) return resolvedRes;

    return ok({ profile: resolvedRes.value, sellerTier: seller.sellerTier });
  }
}
