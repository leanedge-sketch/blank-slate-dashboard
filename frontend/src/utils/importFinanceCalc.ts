import { calculateCustomsDutyAssessment } from "./customsDutyCalc";

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
  /** Official sheet labels 0.07%; applies multiplier 0.007 on CIF base. */
  scanFeePct: 0.007,
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
  targetSellingPriceEtbPerKg: number;
}

export interface ImportFinanceResult {
  capital: {
    materialCostUsdPerKg: number;
    borderValueUsdPerKg: number;
    totalCapitalUsd: number;
    totalCapitalEtb: number;
  };
  customs: {
    fobValueEtb: number;
    cifAssessedUsdPerKg: number;
    totalCifAssessedUsd: number;
    /** Customs Duty Assessment Base (CIF) in ETB. */
    cifBaseEtb: number;
    vatBaseEtb: number;
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
  sales: {
    targetSellingPriceEtbPerKg: number;
    profitPerKgEtb: number;
    grossMarginPct: number;
    totalExpectedRevenueEtb: number;
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

  const customs = calculateCustomsDutyAssessment({
    quantityKg: qty,
    customsRateUsdPerKg: inputs.baseCustomsReferenceUsd,
    officialExchangeRate: inputs.officialRate,
    cifFreightInsuranceBufferPct: constants.freightInsuranceBufferPct,
    customsDutyPct: constants.customsDutyPct,
    scanFeePct: constants.scanFeePct,
    socialFeePct: constants.socialFeePct,
    whtPct: constants.whtPct,
    vatPct: constants.vatPct,
  });

  const cifAssessedUsdPerKg =
    qty > 0
      ? customs.cifValueUsd / qty
      : inputs.baseCustomsReferenceUsd *
        (1 + constants.freightInsuranceBufferPct);

  const totalLocalClearanceEtb = qty * localClearancePerKgEtb;
  const grossInvestmentEtb =
    totalCapitalEtb + customs.totalCustomsFeeEtb + totalLocalClearanceEtb;
  const netLandedCostEtb =
    grossInvestmentEtb - (customs.whtEtb + customs.vatEtb);
  const finalUnitCostEtbPerKg = qty > 0 ? netLandedCostEtb / qty : 0;

  const targetPrice = Math.max(inputs.targetSellingPriceEtbPerKg, 0);
  const profitPerKgEtb = targetPrice - finalUnitCostEtbPerKg;
  const grossMarginPct =
    targetPrice > 0 ? (profitPerKgEtb / targetPrice) * 100 : 0;
  const totalExpectedRevenueEtb = targetPrice * qty;

  return {
    capital: {
      materialCostUsdPerKg,
      borderValueUsdPerKg,
      totalCapitalUsd,
      totalCapitalEtb,
    },
    customs: {
      fobValueEtb: customs.fobValueEtb,
      cifAssessedUsdPerKg,
      totalCifAssessedUsd: customs.cifValueUsd,
      cifBaseEtb: customs.cifValueEtb,
      vatBaseEtb: customs.vatBaseEtb,
      dutyEtb: customs.customDutyEtb,
      scanFeeEtb: customs.scanFeeEtb,
      socialFeeEtb: customs.socialFeeEtb,
      whtEtb: customs.whtEtb,
      vatEtb: customs.vatEtb,
      totalCustomsPaidEtb: customs.totalCustomsFeeEtb,
    },
    bottomLine: {
      totalLocalClearanceEtb,
      grossInvestmentEtb,
      netLandedCostEtb,
      finalUnitCostEtbPerKg,
    },
    sales: {
      targetSellingPriceEtbPerKg: targetPrice,
      profitPerKgEtb,
      grossMarginPct,
      totalExpectedRevenueEtb,
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
