import {
  type CalcError,
  type Result,
  err,
  inputValidation,
  isErr,
  ok,
} from '@core/errors';
import {
  type FeeRateRow,
  type ProfitInputs,
} from '@core/types';
import { resolveFeeProfile } from '@core/fees';
import { type ProfitCalculation, calculateProfit } from '@core/profit-engine';
import type {
  ActiveFeeProfileReader,
  FeeRuleLister,
  SellerProfileReader,
} from './ports';
import type { ProfitRequest } from './types';

export interface CalculationServiceDeps {
  readonly sellerProfiles: SellerProfileReader;
  readonly feeProfiles: ActiveFeeProfileReader;
  readonly feeRules: FeeRuleLister;
}

/**
 * Coordinates the repositories and the frozen Phase 1 calculation core to
 * compute profit for a seller as of a date. It performs NO fee math itself:
 * fee resolution and profit are delegated to calc-core; persistence is
 * delegated to repositories. Repository and calc-core errors propagate
 * unchanged.
 */
export class CalculationService {
  constructor(private readonly deps: CalculationServiceDeps) {}

  async calculateProfit(
    req: ProfitRequest,
  ): Promise<Result<ProfitCalculation, CalcError>> {
    // 1. Load the seller (its tier drives fee resolution).
    const sellerRes = await this.deps.sellerProfiles.getById(req.sellerProfileId);
    if (isErr(sellerRes)) return sellerRes;
    const seller = sellerRes.value;
    if (seller === null) {
      return err(inputValidation('sellerProfileId', 'seller profile not found'));
    }

    // 2. Load the active fee profile for this seller as of the date.
    const fpRes = await this.deps.feeProfiles.findActiveAsOfDate(
      req.sellerProfileId,
      req.asOfDate,
    );
    if (isErr(fpRes)) return fpRes;
    const feeProfile = fpRes.value;
    if (feeProfile === null) {
      return err(
        inputValidation('feeProfile', `no active fee profile as of ${req.asOfDate}`),
      );
    }

    // 3. Load its fee rules.
    const rulesRes = await this.deps.feeRules.list(feeProfile.id);
    if (isErr(rulesRes)) return rulesRes;

    // 4. Convert repository models into frozen Phase 1 FeeRateRow domain objects.
    const rows: FeeRateRow[] = rulesRes.value.map((rule) => ({
      feeType: rule.feeType,
      rate: rule.rate,
      cap: rule.cap,
      effectiveDate: feeProfile.effectiveDate,
      endDate: feeProfile.endDate,
      sourceRef: feeProfile.sourceReference,
    }));

    // 5. Resolve the fee profile via calc-core (handles G-3 completeness etc.).
    const resolvedRes = resolveFeeProfile(seller.sellerTier, req.asOfDate, rows);
    if (isErr(resolvedRes)) return resolvedRes;

    // 6. Invoke the profit engine with the resolved profile.
    const inputs: ProfitInputs = {
      costInputs: req.costInputs,
      sellingPrice: req.sellingPrice,
      discount: req.discount,
      sellerTier: seller.sellerTier,
      asOfDate: req.asOfDate,
      profile: resolvedRes.value,
    };
    return calculateProfit(inputs);
  }
}
