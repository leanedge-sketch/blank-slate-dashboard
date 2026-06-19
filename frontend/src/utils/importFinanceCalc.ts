/** Government tax rates and buffers — defaults match import_finance.finance_constants seed. */
export interface FinanceConstants {
  customsDutyPct: number;
  scanFeePct: number;
  socialFeePct: number;
  whtPct: number;
  vatPct: number;
  freightInsuranceBufferPct: number;
}

export const DEFAULT_FINANCE_CONSTANTS: FinanceConstants = {
  customsDutyPct: 0.05,
  scanFeePct: 0.0007,
  socialFeePct: 0.03,
  whtPct: 0.03,
  vatPct: 0.15,
  freightInsuranceBufferPct: 0.10,
};

export const LOCAL_CLEARANCE_PER_KG_ETB = 20;

export interface ImportFinanceInputs {
  quantityKg: number;
  officialRate: number;
  parallelRate: number;
  supplierBasePriceUsd: number;
  supplierMarginPct: number;
  transportToBorderUsdPerKg: number;
  baseCustomsReferenceUsd: number;
}

export interface ImportFinanceResult {
  capital: {
    materialCostUsdPerKg: number;
    borderValueUsdPerKg: number;
    totalCapitalUsd: number;
    totalCapitalEtb: number;
  };
  customs: {
    cifAssessedUsdPerKg: number;
    totalCifAssessedUsd: number;
    cifBaseEtb: number;
    dutyEtb: number;
    scanFeeEtb: number;
    socialFeeEtb: number;
    whtEtb: number;
    vatEtb: number;
    totalCustomsPaidEtb: number;
  };
  bottomLine: {
    totalLocalClearanceEtb: number;
    grossInvestmentEtb: number;
    netLandedCostEtb: number;
    finalUnitCostEtbPerKg: number;
  };
}

export function calculateImportFinance(
  inputs: ImportFinanceInputs,
  constants: FinanceConstants = DEFAULT_FINANCE_CONSTANTS,
  localClearancePerKgEtb = LOCAL_CLEARANCE_PER_KG_ETB,
): ImportFinanceResult {
  const qty = Math.max(inputs.quantityKg, 0);
  const marginFactor = 1 + inputs.supplierMarginPct / 100;

  const materialCostUsdPerKg = inputs.supplierBasePriceUsd * marginFactor;
  const borderValueUsdPerKg =
    materialCostUsdPerKg + inputs.transportToBorderUsdPerKg;
  const totalCapitalUsd = borderValueUsdPerKg * qty;
  const totalCapitalEtb = totalCapitalUsd * inputs.parallelRate;

  const cifAssessedUsdPerKg =
    inputs.baseCustomsReferenceUsd * (1 + constants.freightInsuranceBufferPct);
  const totalCifAssessedUsd = cifAssessedUsdPerKg * qty;
  const cifBaseEtb = totalCifAssessedUsd * inputs.officialRate;

  const dutyEtb = cifBaseEtb * constants.customsDutyPct;
  const scanFeeEtb = cifBaseEtb * constants.scanFeePct;
  const socialFeeEtb = cifBaseEtb * constants.socialFeePct;
  const whtEtb = cifBaseEtb * constants.whtPct;
  const vatEtb = cifBaseEtb * constants.vatPct;
  const totalCustomsPaidEtb =
    dutyEtb + scanFeeEtb + socialFeeEtb + whtEtb + vatEtb;

  const totalLocalClearanceEtb = qty * localClearancePerKgEtb;
  const grossInvestmentEtb =
    totalCapitalEtb + totalCustomsPaidEtb + totalLocalClearanceEtb;
  const netLandedCostEtb = grossInvestmentEtb - (whtEtb + vatEtb);
  const finalUnitCostEtbPerKg = qty > 0 ? netLandedCostEtb / qty : 0;

  return {
    capital: {
      materialCostUsdPerKg,
      borderValueUsdPerKg,
      totalCapitalUsd,
      totalCapitalEtb,
    },
    customs: {
      cifAssessedUsdPerKg,
      totalCifAssessedUsd,
      cifBaseEtb,
      dutyEtb,
      scanFeeEtb,
      socialFeeEtb,
      whtEtb,
      vatEtb,
      totalCustomsPaidEtb,
    },
    bottomLine: {
      totalLocalClearanceEtb,
      grossInvestmentEtb,
      netLandedCostEtb,
      finalUnitCostEtbPerKg,
    },
  };
}

export function formatEtb(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatUsd(value: number, fractionDigits = 4): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatNumber(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
