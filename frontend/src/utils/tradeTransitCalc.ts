import {
  DEFAULT_FINANCE_CONSTANTS,
  normalizeScanFeePct,
  type FinanceConstants,
} from "./importFinanceCalc";
import { calculateCustomsDutyAssessment } from "./customsDutyCalc";

export type { CustomsDutyAssessmentInput, CustomsDutyAssessmentResult } from "./customsDutyCalc";
export { calculateCustomsDutyAssessment };

export const CIF_BUFFER_PCT = 0.1;
export const DEFAULT_INLAND_ETB_PER_KG = 20;
export const DEFAULT_TARGET_MARGIN_PCT = 20;

export interface MiscBorderCostLine {
  id: string;
  amountUsd: number;
  reason: string;
}

export type SellingPriceMode = "margin" | "manual";

export interface TradeTransitInputs {
  quantityKg: number;
  targetSellingPriceEtbPerKg: number;
  targetMarginPct: number;
  sellingPriceMode: SellingPriceMode;
  supplierBasePriceUsd: number;
  supplierMarginPct: number;
  transportToMoyaleUsdPerKg: number;
  miscBorderCosts: MiscBorderCostLine[];
  capitalParallelRate: number;
  customsOfficialRate: number;
  baseCustomsReferenceUsd: number;
  /** CIF = base reference × (1 + buffer). Decimal, e.g. 0.10 = 10%. */
  cifBufferPct: number;
  /** Share of CIF base ETB. Decimals, e.g. 0.05 = 5%. */
  customsDutyPct: number;
  scanFeePct: number;
  socialFeePct: number;
  whtPct: number;
  vatPct: number;
  surtaxPct: number;
  excisePct: number;
  taxSpecialGoodsPct: number;
  inlandClearancePerKgEtb: number;
}

export function customsRatesFromConstants(
  constants: FinanceConstants = DEFAULT_FINANCE_CONSTANTS,
): Pick<
  TradeTransitInputs,
  | "cifBufferPct"
  | "customsDutyPct"
  | "scanFeePct"
  | "socialFeePct"
  | "whtPct"
  | "vatPct"
> {
  return {
    cifBufferPct: constants.freightInsuranceBufferPct,
    customsDutyPct: constants.customsDutyPct,
    scanFeePct: normalizeScanFeePct(constants.scanFeePct),
    socialFeePct: constants.socialFeePct,
    whtPct: constants.whtPct,
    vatPct: constants.vatPct,
  };
}

export interface TradeTransitResult {
  stage1: {
    materialUsdPerKg: number;
    transportUsdPerKg: number;
    miscBorderUsdTotal: number;
    miscBorderLines: MiscBorderCostLine[];
    borderUsdPerKg: number;
    totalBorderUsd: number;
    capitalParallelRate: number;
    capitalOutlayEtb: number;
  };
  stage2: {
    fobValueEtb: number;
    cifUsdPerKg: number;
    totalCifUsd: number;
    customsOfficialRate: number;
    /** Customs Duty Assessment Base (CIF) in ETB. */
    cifBaseEtb: number;
    vatBaseEtb: number;
    dutyEtb: number;
    scanFeeEtb: number;
    socialFeeEtb: number;
    specialGoodsEtb: number;
    whtEtb: number;
    vatEtb: number;
    surtaxEtb: number;
    exciseEtb: number;
    totalCustomsPaidEtb: number;
  };
  stage3: {
    inlandTransportEtb: number;
    grossInvestmentEtb: number;
    refundableWhtVatEtb: number;
    netLandedCostEtb: number;
    finalLandedUnitCostEtbPerKg: number;
  };
  stage4: {
    unitCostEtbPerKg: number;
    targetSellingPriceEtbPerKg: number;
    profitPerKgEtb: number;
    grossMarginPct: number;
    totalExpectedRevenueEtb: number;
    sellingPriceMode: SellingPriceMode;
    targetMarginPct: number;
  };
}

export const DEFAULT_TRADE_TRANSIT_INPUTS: TradeTransitInputs = {
  quantityKg: 20000,
  targetSellingPriceEtbPerKg: 0,
  targetMarginPct: DEFAULT_TARGET_MARGIN_PCT,
  sellingPriceMode: "margin",
  supplierBasePriceUsd: 0.9,
  supplierMarginPct: 10,
  transportToMoyaleUsdPerKg: 0.14,
  miscBorderCosts: [],
  capitalParallelRate: 190,
  customsOfficialRate: 156,
  baseCustomsReferenceUsd: 0.792,
  ...customsRatesFromConstants(DEFAULT_FINANCE_CONSTANTS),
  surtaxPct: 0,
  excisePct: 0,
  taxSpecialGoodsPct: 0,
  inlandClearancePerKgEtb: DEFAULT_INLAND_ETB_PER_KG,
};

export function roundFinancial(value: number, decimalPlaces = 4): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** True gross margin: sellingPrice = unitCost / (1 − marginDecimal). */
export function calculateSellingPriceFromTargetMargin(
  unitCost: number,
  targetMarginDecimal: number,
  decimalPlaces = 4,
): {
  sellingPrice: number;
  marginValue: number;
  grossMarginDecimal: number;
} {
  if (targetMarginDecimal >= 1) {
    throw new Error("Target margin must be less than 100% (decimal < 1).");
  }
  if (targetMarginDecimal < 0) {
    throw new Error("Target margin cannot be negative.");
  }

  const divisor = 1 - targetMarginDecimal;
  const sellingPrice = roundFinancial(unitCost / divisor, decimalPlaces);
  const marginValue = roundFinancial(sellingPrice - unitCost, decimalPlaces);
  const grossMarginDecimal =
    sellingPrice > 0 ? roundFinancial(marginValue / sellingPrice, 6) : 0;

  return { sellingPrice, marginValue, grossMarginDecimal };
}

export function calculateMarginFromSellingPrice(
  unitCost: number,
  sellingPrice: number,
  decimalPlaces = 4,
): { marginValue: number; grossMarginPct: number } {
  const marginValue = roundFinancial(sellingPrice - unitCost, decimalPlaces);
  const grossMarginPct =
    sellingPrice > 0
      ? roundFinancial((marginValue / sellingPrice) * 100, 2)
      : 0;
  return { marginValue, grossMarginPct };
}

export function createMiscBorderCostLine(
  partial?: Partial<MiscBorderCostLine>,
): MiscBorderCostLine {
  return {
    id:
      partial?.id ??
      `misc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    amountUsd: partial?.amountUsd ?? 0,
    reason: partial?.reason ?? "",
  };
}

export function sumMiscBorderCosts(lines: MiscBorderCostLine[]): number {
  return lines.reduce(
    (sum, line) => sum + Math.max(Number(line.amountUsd) || 0, 0),
    0,
  );
}

export function calculateTradeTransit(
  inputs: TradeTransitInputs,
  _constants: FinanceConstants = DEFAULT_FINANCE_CONSTANTS,
): TradeTransitResult {
  const qty = Math.max(inputs.quantityKg, 0);
  const marginFactor = 1 + inputs.supplierMarginPct / 100;

  const materialUsdPerKg = inputs.supplierBasePriceUsd * marginFactor;
  const transportUsdPerKg = inputs.transportToMoyaleUsdPerKg;
  const miscBorderUsdTotal = sumMiscBorderCosts(inputs.miscBorderCosts);
  const borderUsdPerKg = materialUsdPerKg + transportUsdPerKg;
  const totalBorderUsd = borderUsdPerKg * qty + miscBorderUsdTotal;
  const capitalOutlayEtb = totalBorderUsd * inputs.capitalParallelRate;

  const customs = calculateCustomsDutyAssessment({
    quantityKg: qty,
    customsRateUsdPerKg: inputs.baseCustomsReferenceUsd,
    officialExchangeRate: inputs.customsOfficialRate,
    cifFreightInsuranceBufferPct: inputs.cifBufferPct,
    customsDutyPct: inputs.customsDutyPct,
    scanFeePct: inputs.scanFeePct,
    socialFeePct: inputs.socialFeePct,
    whtPct: inputs.whtPct,
    vatPct: inputs.vatPct,
    specialGoodsPct: inputs.taxSpecialGoodsPct,
    surtaxPct: inputs.surtaxPct,
    excisePct: inputs.excisePct,
  });

  const cifUsdPerKg =
    qty > 0
      ? customs.cifValueUsd / qty
      : inputs.baseCustomsReferenceUsd * (1 + inputs.cifBufferPct);

  const inlandTransportEtb = qty * inputs.inlandClearancePerKgEtb;
  const grossInvestmentEtb =
    capitalOutlayEtb + customs.totalCustomsFeeEtb + inlandTransportEtb;
  const refundableWhtVatEtb = customs.whtEtb + customs.vatEtb;
  const netLandedCostEtb = grossInvestmentEtb - refundableWhtVatEtb;
  const unitCostEtbPerKg = qty > 0 ? netLandedCostEtb / qty : 0;

  const marginDecimal = inputs.targetMarginPct / 100;
  let targetPrice: number;
  let profitPerKgEtb: number;
  let grossMarginPct: number;

  if (inputs.sellingPriceMode === "margin") {
    const priced = calculateSellingPriceFromTargetMargin(
      unitCostEtbPerKg,
      marginDecimal,
      4,
    );
    targetPrice = priced.sellingPrice;
    profitPerKgEtb = priced.marginValue;
    grossMarginPct = roundFinancial(priced.grossMarginDecimal * 100, 2);
  } else {
    targetPrice = Math.max(inputs.targetSellingPriceEtbPerKg, 0);
    const manual = calculateMarginFromSellingPrice(
      unitCostEtbPerKg,
      targetPrice,
      4,
    );
    profitPerKgEtb = manual.marginValue;
    grossMarginPct = manual.grossMarginPct;
  }

  return {
    stage1: {
      materialUsdPerKg,
      transportUsdPerKg,
      miscBorderUsdTotal,
      miscBorderLines: inputs.miscBorderCosts,
      borderUsdPerKg,
      totalBorderUsd,
      capitalParallelRate: inputs.capitalParallelRate,
      capitalOutlayEtb,
    },
    stage2: {
      fobValueEtb: customs.fobValueEtb,
      cifUsdPerKg,
      totalCifUsd: customs.cifValueUsd,
      customsOfficialRate: inputs.customsOfficialRate,
      cifBaseEtb: customs.cifValueEtb,
      vatBaseEtb: customs.vatBaseEtb,
      dutyEtb: customs.customDutyEtb,
      scanFeeEtb: customs.scanFeeEtb,
      socialFeeEtb: customs.socialFeeEtb,
      specialGoodsEtb: customs.specialGoodsEtb,
      whtEtb: customs.whtEtb,
      vatEtb: customs.vatEtb,
      surtaxEtb: customs.surtaxEtb,
      exciseEtb: customs.exciseEtb,
      totalCustomsPaidEtb: customs.totalCustomsFeeEtb,
    },
    stage3: {
      inlandTransportEtb,
      grossInvestmentEtb,
      refundableWhtVatEtb,
      netLandedCostEtb,
      finalLandedUnitCostEtbPerKg: unitCostEtbPerKg,
    },
    stage4: {
      unitCostEtbPerKg,
      targetSellingPriceEtbPerKg: targetPrice,
      profitPerKgEtb,
      grossMarginPct,
      totalExpectedRevenueEtb: targetPrice * qty,
      sellingPriceMode: inputs.sellingPriceMode,
      targetMarginPct: inputs.targetMarginPct,
    },
  };
}

export function legacyShipmentToTradeTransit(row: {
  quantity_kg: number;
  snapshot_official_rate: number;
  snapshot_parallel_rate: number;
  supplier_base_price_usd: number;
  supplier_margin_pct: number;
  transport_to_border_usd: number;
  snapshot_base_customs_reference_usd?: number | null;
  target_selling_price_etb_per_kg?: number | null;
  local_clearance_per_kg_etb?: number | null;
}): TradeTransitInputs {
  const savedPrice = Number(row.target_selling_price_etb_per_kg ?? 0);
  return {
    quantityKg: Number(row.quantity_kg),
    targetSellingPriceEtbPerKg: savedPrice,
    targetMarginPct: DEFAULT_TARGET_MARGIN_PCT,
    sellingPriceMode: savedPrice > 0 ? "manual" : "margin",
    supplierBasePriceUsd: Number(row.supplier_base_price_usd),
    supplierMarginPct: Number(row.supplier_margin_pct),
    transportToMoyaleUsdPerKg: Number(row.transport_to_border_usd),
    miscBorderCosts: [],
    capitalParallelRate: Number(row.snapshot_parallel_rate),
    customsOfficialRate: Number(row.snapshot_official_rate),
    baseCustomsReferenceUsd: Number(row.snapshot_base_customs_reference_usd ?? 0),
    ...customsRatesFromConstants(DEFAULT_FINANCE_CONSTANTS),
    surtaxPct: 0,
    excisePct: 0,
    taxSpecialGoodsPct: 0,
    inlandClearancePerKgEtb: Number(
      row.local_clearance_per_kg_etb ?? DEFAULT_INLAND_ETB_PER_KG,
    ),
  };
}

export function tradeTransitToLegacyInputs(
  inputs: TradeTransitInputs,
  result?: TradeTransitResult,
): import("./importFinanceCalc").ImportFinanceInputs {
  const computed = result ?? calculateTradeTransit(inputs);
  return {
    quantityKg: inputs.quantityKg,
    officialRate: inputs.customsOfficialRate,
    parallelRate: inputs.capitalParallelRate,
    supplierBasePriceUsd: inputs.supplierBasePriceUsd,
    supplierMarginPct: inputs.supplierMarginPct,
    transportToBorderUsdPerKg: inputs.transportToMoyaleUsdPerKg,
    baseCustomsReferenceUsd: inputs.baseCustomsReferenceUsd,
    targetSellingPriceEtbPerKg: computed.stage4.targetSellingPriceEtbPerKg,
  };
}
