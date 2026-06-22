import { DEFAULT_FINANCE_CONSTANTS } from "./importFinanceCalc";

export const CIF_FREIGHT_INSURANCE_BUFFER_PCT = 0.1;

function roundFinancial(value: number, decimalPlaces = 2): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** Inputs for customs duty assessment (FOB → CIF → duties & VAT). */
export interface CustomsDutyAssessmentInput {
  quantityKg: number;
  /** USD/kg customs reference (FOB assessment rate). */
  customsRateUsdPerKg: number;
  officialExchangeRate: number;
  /** Decimal buffer on FOB, e.g. 0.10 → multiply FOB ETB by 1.10 for CIF. */
  cifFreightInsuranceBufferPct?: number;
  customsDutyPct?: number;
  scanFeePct?: number;
  socialFeePct?: number;
  whtPct?: number;
  vatPct?: number;
  specialGoodsPct?: number;
  surtaxPct?: number;
  excisePct?: number;
}

export interface CustomsDutyAssessmentResult {
  fobValueUsd: number;
  fobValueEtb: number;
  /** Customs Duty Assessment Base (CIF) — FOB ETB × (1 + freight/insurance buffer). */
  cifValueEtb: number;
  cifValueUsd: number;
  customDutyEtb: number;
  scanFeeEtb: number;
  socialFeeEtb: number;
  whtEtb: number;
  /** VAT base = CIF + customs duty + social fee. */
  vatBaseEtb: number;
  vatEtb: number;
  specialGoodsEtb: number;
  surtaxEtb: number;
  exciseEtb: number;
  /** Sum of payable customs lines — excludes CIF assessment base. */
  totalCustomsFeeEtb: number;
}

/**
 * Customs tax waterfall from FOB through CIF assessment base.
 * Scan fee: official sheet label is 0.07% but multiplier is 0.007 (legacy Excel).
 * VAT is applied to (CIF + duty + social), not to CIF alone.
 */
export function calculateCustomsDutyAssessment(
  params: CustomsDutyAssessmentInput,
  decimalPlaces = 2,
): CustomsDutyAssessmentResult {
  const qty = Math.max(params.quantityKg, 0);
  const bufferPct =
    params.cifFreightInsuranceBufferPct ?? CIF_FREIGHT_INSURANCE_BUFFER_PCT;
  const cifMultiplier = 1 + bufferPct;

  const dutyPct =
    params.customsDutyPct ?? DEFAULT_FINANCE_CONSTANTS.customsDutyPct;
  const scanPct = params.scanFeePct ?? DEFAULT_FINANCE_CONSTANTS.scanFeePct;
  const socialPct =
    params.socialFeePct ?? DEFAULT_FINANCE_CONSTANTS.socialFeePct;
  const whtPct = params.whtPct ?? DEFAULT_FINANCE_CONSTANTS.whtPct;
  const vatPct = params.vatPct ?? DEFAULT_FINANCE_CONSTANTS.vatPct;
  const specialPct = params.specialGoodsPct ?? 0;
  const surtaxPct = params.surtaxPct ?? 0;
  const excisePct = params.excisePct ?? 0;

  const fobValueUsd = qty * params.customsRateUsdPerKg;
  const fobValueEtb = roundFinancial(
    fobValueUsd * params.officialExchangeRate,
    decimalPlaces,
  );
  const cifValueEtb = roundFinancial(fobValueEtb * cifMultiplier, decimalPlaces);
  const cifValueUsd = roundFinancial(fobValueUsd * cifMultiplier, 4);

  const customDutyEtb = roundFinancial(cifValueEtb * dutyPct, decimalPlaces);
  const scanFeeEtb = roundFinancial(cifValueEtb * scanPct, decimalPlaces);
  const socialFeeEtb = roundFinancial(cifValueEtb * socialPct, decimalPlaces);
  const specialGoodsEtb = roundFinancial(
    cifValueEtb * (specialPct / 100),
    decimalPlaces,
  );
  const whtEtb = roundFinancial(cifValueEtb * whtPct, decimalPlaces);
  const surtaxEtb = roundFinancial(cifValueEtb * surtaxPct, decimalPlaces);
  const exciseEtb = roundFinancial(cifValueEtb * excisePct, decimalPlaces);

  const vatBaseEtb = roundFinancial(
    cifValueEtb + customDutyEtb + socialFeeEtb,
    decimalPlaces,
  );
  const vatEtb = roundFinancial(vatBaseEtb * vatPct, 3);

  const totalCustomsFeeEtb = roundFinancial(
    customDutyEtb +
      scanFeeEtb +
      socialFeeEtb +
      whtEtb +
      vatEtb +
      specialGoodsEtb +
      surtaxEtb +
      exciseEtb,
    decimalPlaces,
  );

  return {
    fobValueUsd,
    fobValueEtb,
    cifValueEtb,
    cifValueUsd,
    customDutyEtb,
    scanFeeEtb,
    socialFeeEtb,
    whtEtb,
    vatBaseEtb,
    vatEtb,
    specialGoodsEtb,
    surtaxEtb,
    exciseEtb,
    totalCustomsFeeEtb,
  };
}
