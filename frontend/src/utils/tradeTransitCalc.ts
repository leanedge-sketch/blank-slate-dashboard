import {
  DEFAULT_FINANCE_CONSTANTS,
  normalizeScanFeePct,
  type FinanceConstants,
} from "./importFinanceCalc";
import { calculateCustomsDutyAssessment } from "./customsDutyCalc";
import type { ImportShipmentRow } from "../services/importFinance";

export type { CustomsDutyAssessmentInput, CustomsDutyAssessmentResult } from "./customsDutyCalc";
export { calculateCustomsDutyAssessment };

export const CIF_BUFFER_PCT = 0.1;
export const DEFAULT_INLAND_ETB_PER_KG = 20;
export const DEFAULT_TARGET_MARGIN_PCT = 20;
/** Bank charges = capital outlay × this rate (legacy Excel: 7.8%). */
export const DEFAULT_BANK_CHARGE_PCT_ON_CAPITAL = 0.078;
export const DEFAULT_TRANSIT_INSURANCE_ETB = 1000;
export const DEFAULT_BETCHEM_CLEARANCE_ETB = 13500;
/**
 * Profit tax = pre-landed base × this rate.
 * Pre-landed = capital + bank + insurance + customs + betchem + transport − refundables.
 */
export const DEFAULT_PROFIT_TAX_PCT_ON_PRE_LANDED =
  235_243.01 / 5_279_910.532;

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
  /** Bank charges as decimal share of capital outlay (default 7.8%). */
  bankChargePctOnCapital: number;
  /** Transit insurance (ETB flat). */
  insuranceEtb: number;
  /** Betchem clearance fee (ETB flat). */
  betchemClearanceEtb: number;
  /** Profit tax as decimal share of pre-landed base. */
  profitTaxPctOnPreLanded: number;
  /**
   * When set, overrides Stage 1 capital outlay (legacy sheet "Amount In Birr").
   * Bank charges still use this ETB base when combined with bankChargePctOnCapital.
   */
  fixedCapitalOutlayEtb?: number | null;
  /** Excel totals — when set, calculator uses workbook values instead of recomputed waterfall. */
  workbookTotalCustomsFeeEtb?: number | null;
  workbookNetLandedCostEtb?: number | null;
  workbookUnitCostEtbPerKg?: number | null;
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
    bankChargesEtb: number;
    insuranceEtb: number;
    betchemClearanceEtb: number;
    /** Inland / Addis transport (ETB). */
    transportAddisEtb: number;
    inlandTransportEtb: number;
    grossInvestmentEtb: number;
    refundableWhtVatEtb: number;
    /** Base before profit tax (capital + bank + insurance + customs + betchem + transport − refundables). */
    preProfitLandedBaseEtb: number;
    profitTaxEtb: number;
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
  bankChargePctOnCapital: DEFAULT_BANK_CHARGE_PCT_ON_CAPITAL,
  insuranceEtb: DEFAULT_TRANSIT_INSURANCE_ETB,
  betchemClearanceEtb: DEFAULT_BETCHEM_CLEARANCE_ETB,
  profitTaxPctOnPreLanded: DEFAULT_PROFIT_TAX_PCT_ON_PRE_LANDED,
};

/** Calculator defaults for a new pipeline line; quantity and supplier price left empty. */
export function newPipelineLineInputs(
  overrides?: Partial<TradeTransitInputs>,
): TradeTransitInputs {
  return {
    ...DEFAULT_TRADE_TRANSIT_INPUTS,
    quantityKg: 0,
    supplierBasePriceUsd: 0,
    ...overrides,
  };
}

/** @deprecated Use newPipelineLineInputs */
export const blankTradeTransitLineInputs = newPipelineLineInputs;

export function roundFinancial(value: number, decimalPlaces = 4): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** Coerce unknown numeric input; NaN / null / undefined → fallback. */
export function finiteNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Ensure calculator inputs are finite before customs / landed-cost math. */
export function sanitizeTradeTransitInputs(
  inputs: TradeTransitInputs,
): TradeTransitInputs {
  const defaults = DEFAULT_TRADE_TRANSIT_INPUTS;
  const fixedCapital =
    inputs.fixedCapitalOutlayEtb != null
      ? finiteNumber(inputs.fixedCapitalOutlayEtb, 0)
      : inputs.fixedCapitalOutlayEtb;

  return {
    ...inputs,
    quantityKg: finiteNumber(inputs.quantityKg, 0),
    targetSellingPriceEtbPerKg: finiteNumber(
      inputs.targetSellingPriceEtbPerKg,
      0,
    ),
    targetMarginPct: finiteNumber(inputs.targetMarginPct, defaults.targetMarginPct),
    supplierBasePriceUsd: finiteNumber(
      inputs.supplierBasePriceUsd,
      defaults.supplierBasePriceUsd,
    ),
    supplierMarginPct: finiteNumber(
      inputs.supplierMarginPct,
      defaults.supplierMarginPct,
    ),
    transportToMoyaleUsdPerKg: finiteNumber(
      inputs.transportToMoyaleUsdPerKg,
      defaults.transportToMoyaleUsdPerKg,
    ),
    miscBorderCosts: (inputs.miscBorderCosts ?? []).map((line) => ({
      ...line,
      amountUsd: finiteNumber(line.amountUsd, 0),
    })),
    capitalParallelRate: finiteNumber(
      inputs.capitalParallelRate,
      defaults.capitalParallelRate,
    ),
    customsOfficialRate: finiteNumber(
      inputs.customsOfficialRate,
      defaults.customsOfficialRate,
    ),
    baseCustomsReferenceUsd: finiteNumber(
      inputs.baseCustomsReferenceUsd,
      defaults.baseCustomsReferenceUsd,
    ),
    cifBufferPct: finiteNumber(inputs.cifBufferPct, defaults.cifBufferPct),
    customsDutyPct: finiteNumber(inputs.customsDutyPct, defaults.customsDutyPct),
    scanFeePct: finiteNumber(inputs.scanFeePct, defaults.scanFeePct),
    socialFeePct: finiteNumber(inputs.socialFeePct, defaults.socialFeePct),
    whtPct: finiteNumber(inputs.whtPct, defaults.whtPct),
    vatPct: finiteNumber(inputs.vatPct, defaults.vatPct),
    surtaxPct: finiteNumber(inputs.surtaxPct, defaults.surtaxPct),
    excisePct: finiteNumber(inputs.excisePct, defaults.excisePct),
    taxSpecialGoodsPct: finiteNumber(
      inputs.taxSpecialGoodsPct,
      defaults.taxSpecialGoodsPct,
    ),
    inlandClearancePerKgEtb: finiteNumber(
      inputs.inlandClearancePerKgEtb,
      defaults.inlandClearancePerKgEtb,
    ),
    bankChargePctOnCapital: finiteNumber(
      inputs.bankChargePctOnCapital,
      defaults.bankChargePctOnCapital,
    ),
    insuranceEtb: finiteNumber(inputs.insuranceEtb, defaults.insuranceEtb),
    betchemClearanceEtb: finiteNumber(
      inputs.betchemClearanceEtb,
      defaults.betchemClearanceEtb,
    ),
    profitTaxPctOnPreLanded: finiteNumber(
      inputs.profitTaxPctOnPreLanded,
      defaults.profitTaxPctOnPreLanded,
    ),
    fixedCapitalOutlayEtb:
      fixedCapital != null && fixedCapital > 0 ? fixedCapital : null,
    workbookTotalCustomsFeeEtb: optionalPositive(inputs.workbookTotalCustomsFeeEtb),
    workbookNetLandedCostEtb: optionalPositive(inputs.workbookNetLandedCostEtb),
    workbookUnitCostEtbPerKg: optionalPositive(inputs.workbookUnitCostEtbPerKg),
  };
}

function optionalPositive(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = finiteNumber(value, 0);
  return parsed > 0 ? parsed : null;
}

/**
 * Legacy Excel market strategy pricing (UI label: "20% margin").
 * profitPerKg = (unitCost / (1 − margin)) × (margin / 2)
 * sellingPrice = unitCost + profitPerKg
 * At 20%: profit = (unitCost / 0.8) × 0.1
 */
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
  const marginValue = roundFinancial(
    (unitCost / divisor) * (targetMarginDecimal / 2),
    2,
  );
  const sellingPrice = roundFinancial(unitCost + marginValue, 2);
  const grossMarginDecimal =
    sellingPrice > 0 ? roundFinancial(marginValue / sellingPrice, 6) : 0;

  return {
    sellingPrice: roundFinancial(sellingPrice, decimalPlaces),
    marginValue: roundFinancial(marginValue, decimalPlaces),
    grossMarginDecimal,
  };
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

export interface LandedCostInput {
  capitalOutlayEtb: number;
  totalCustomsFeeEtb: number;
  refundableWhtVatEtb: number;
  quantityKg: number;
  inlandClearancePerKgEtb: number;
  bankChargePctOnCapital: number;
  insuranceEtb: number;
  betchemClearanceEtb: number;
  profitTaxPctOnPreLanded: number;
}

export interface LandedCostResult {
  bankChargesEtb: number;
  insuranceEtb: number;
  betchemClearanceEtb: number;
  transportAddisEtb: number;
  grossInvestmentEtb: number;
  refundableWhtVatEtb: number;
  preProfitLandedBaseEtb: number;
  profitTaxEtb: number;
  netLandedCostEtb: number;
  finalLandedUnitCostEtbPerKg: number;
}

/**
 * Stage 3 landed cost (legacy Excel parity):
 * total = capital + bank + insurance + customs + betchem + transport − refundables + profitTax
 */
export function calculateLandedCost(params: LandedCostInput): LandedCostResult {
  const qty = Math.max(params.quantityKg, 0);
  const transportAddisEtb = roundFinancial(
    qty * params.inlandClearancePerKgEtb,
    2,
  );
  const bankChargesEtb = roundFinancial(
    params.capitalOutlayEtb * params.bankChargePctOnCapital,
    2,
  );
  const insuranceEtb = roundFinancial(params.insuranceEtb, 2);
  const betchemClearanceEtb = roundFinancial(params.betchemClearanceEtb, 2);
  const refundableWhtVatEtb = roundFinancial(params.refundableWhtVatEtb, 2);

  const grossInvestmentEtb = roundFinancial(
    params.capitalOutlayEtb +
      params.totalCustomsFeeEtb +
      transportAddisEtb,
    2,
  );

  const preProfitLandedBaseEtb = roundFinancial(
    params.capitalOutlayEtb +
      bankChargesEtb +
      insuranceEtb +
      params.totalCustomsFeeEtb +
      betchemClearanceEtb +
      transportAddisEtb -
      refundableWhtVatEtb,
    2,
  );

  const profitTaxEtb = roundFinancial(
    preProfitLandedBaseEtb * params.profitTaxPctOnPreLanded,
    2,
  );

  const netLandedCostEtb = roundFinancial(
    preProfitLandedBaseEtb + profitTaxEtb,
    2,
  );

  const finalLandedUnitCostEtbPerKg =
    qty > 0 ? roundFinancial(netLandedCostEtb / qty, 4) : 0;

  return {
    bankChargesEtb,
    insuranceEtb,
    betchemClearanceEtb,
    transportAddisEtb,
    grossInvestmentEtb,
    refundableWhtVatEtb,
    preProfitLandedBaseEtb,
    profitTaxEtb,
    netLandedCostEtb,
    finalLandedUnitCostEtbPerKg,
  };
}

export function calculateTradeTransit(
  inputs: TradeTransitInputs,
  _constants: FinanceConstants = DEFAULT_FINANCE_CONSTANTS,
): TradeTransitResult {
  const safe = sanitizeTradeTransitInputs(inputs);
  const qty = Math.max(safe.quantityKg, 0);
  const marginFactor = 1 + safe.supplierMarginPct / 100;

  const materialUsdPerKg = safe.supplierBasePriceUsd * marginFactor;
  const transportUsdPerKg = safe.transportToMoyaleUsdPerKg;
  const miscBorderUsdTotal = sumMiscBorderCosts(safe.miscBorderCosts);
  const borderUsdPerKg = materialUsdPerKg + transportUsdPerKg;
  const totalBorderUsd = borderUsdPerKg * qty + miscBorderUsdTotal;
  const capitalOutlayEtb =
    safe.fixedCapitalOutlayEtb != null && safe.fixedCapitalOutlayEtb > 0
      ? roundFinancial(safe.fixedCapitalOutlayEtb, 2)
      : roundFinancial(totalBorderUsd * safe.capitalParallelRate, 2);

  const customs = calculateCustomsDutyAssessment({
    quantityKg: qty,
    customsRateUsdPerKg: safe.baseCustomsReferenceUsd,
    officialExchangeRate: safe.customsOfficialRate,
    cifFreightInsuranceBufferPct: safe.cifBufferPct,
    customsDutyPct: safe.customsDutyPct,
    scanFeePct: safe.scanFeePct,
    socialFeePct: safe.socialFeePct,
    whtPct: safe.whtPct,
    vatPct: safe.vatPct,
    specialGoodsPct: safe.taxSpecialGoodsPct,
    surtaxPct: safe.surtaxPct,
    excisePct: safe.excisePct,
  });

  const cifUsdPerKg =
    qty > 0
      ? customs.cifValueUsd / qty
      : safe.baseCustomsReferenceUsd * (1 + safe.cifBufferPct);

  const inlandTransportEtb = qty * safe.inlandClearancePerKgEtb;
  const refundableWhtVatEtb = customs.whtEtb + customs.vatEtb;

  let totalCustomsPaidEtb = customs.totalCustomsFeeEtb;
  if (safe.workbookTotalCustomsFeeEtb != null) {
    totalCustomsPaidEtb = roundFinancial(safe.workbookTotalCustomsFeeEtb, 2);
  }

  const landed = calculateLandedCost({
    capitalOutlayEtb,
    totalCustomsFeeEtb: totalCustomsPaidEtb,
    refundableWhtVatEtb,
    quantityKg: qty,
    inlandClearancePerKgEtb: safe.inlandClearancePerKgEtb,
    bankChargePctOnCapital: safe.bankChargePctOnCapital,
    insuranceEtb: safe.insuranceEtb,
    betchemClearanceEtb: safe.betchemClearanceEtb,
    profitTaxPctOnPreLanded: safe.profitTaxPctOnPreLanded,
  });

  let netLandedCostEtb = landed.netLandedCostEtb;
  let finalLandedUnitCostEtbPerKg = landed.finalLandedUnitCostEtbPerKg;

  if (safe.workbookNetLandedCostEtb != null) {
    netLandedCostEtb = roundFinancial(safe.workbookNetLandedCostEtb, 2);
  }
  if (safe.workbookUnitCostEtbPerKg != null) {
    finalLandedUnitCostEtbPerKg = roundFinancial(
      safe.workbookUnitCostEtbPerKg,
      4,
    );
  } else if (safe.workbookNetLandedCostEtb != null && qty > 0) {
    finalLandedUnitCostEtbPerKg = roundFinancial(netLandedCostEtb / qty, 4);
  }

  const unitCostEtbPerKg = finalLandedUnitCostEtbPerKg;

  const marginDecimal = safe.targetMarginPct / 100;
  let targetPrice: number;
  let profitPerKgEtb: number;
  let grossMarginPct: number;

  if (safe.sellingPriceMode === "margin") {
    const priced = calculateSellingPriceFromTargetMargin(
      unitCostEtbPerKg,
      marginDecimal,
      4,
    );
    targetPrice = priced.sellingPrice;
    profitPerKgEtb = priced.marginValue;
    grossMarginPct = roundFinancial(priced.grossMarginDecimal * 100, 2);
  } else {
    targetPrice = Math.max(safe.targetSellingPriceEtbPerKg, 0);
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
      miscBorderLines: safe.miscBorderCosts,
      borderUsdPerKg,
      totalBorderUsd,
      capitalParallelRate: safe.capitalParallelRate,
      capitalOutlayEtb,
    },
    stage2: {
      fobValueEtb: customs.fobValueEtb,
      cifUsdPerKg,
      totalCifUsd: customs.cifValueUsd,
      customsOfficialRate: safe.customsOfficialRate,
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
      totalCustomsPaidEtb: totalCustomsPaidEtb,
    },
    stage3: {
      bankChargesEtb: landed.bankChargesEtb,
      insuranceEtb: landed.insuranceEtb,
      betchemClearanceEtb: landed.betchemClearanceEtb,
      transportAddisEtb: landed.transportAddisEtb,
      inlandTransportEtb: landed.transportAddisEtb,
      grossInvestmentEtb: landed.grossInvestmentEtb,
      refundableWhtVatEtb: landed.refundableWhtVatEtb,
      preProfitLandedBaseEtb: landed.preProfitLandedBaseEtb,
      profitTaxEtb: landed.profitTaxEtb,
      netLandedCostEtb,
      finalLandedUnitCostEtbPerKg,
    },
    stage4: {
      unitCostEtbPerKg,
      targetSellingPriceEtbPerKg: targetPrice,
      profitPerKgEtb,
      grossMarginPct,
      totalExpectedRevenueEtb: roundFinancial(targetPrice * qty, 2),
      sellingPriceMode: safe.sellingPriceMode,
      targetMarginPct: safe.targetMarginPct,
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
    bankChargePctOnCapital: DEFAULT_BANK_CHARGE_PCT_ON_CAPITAL,
    insuranceEtb: DEFAULT_TRANSIT_INSURANCE_ETB,
    betchemClearanceEtb: DEFAULT_BETCHEM_CLEARANCE_ETB,
    profitTaxPctOnPreLanded: DEFAULT_PROFIT_TAX_PCT_ON_PRE_LANDED,
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

/** Map full trade-transit waterfall output to legacy import-finance result for DB save. */
export function importFinanceResultFromTradeTransit(
  inputs: TradeTransitInputs,
  result: TradeTransitResult,
): import("./importFinanceCalc").ImportFinanceResult {
  const qty = Math.max(inputs.quantityKg, 0);
  return {
    capital: {
      materialCostUsdPerKg: result.stage1.materialUsdPerKg,
      borderValueUsdPerKg: result.stage1.borderUsdPerKg,
      totalCapitalUsd: result.stage1.totalBorderUsd,
      totalCapitalEtb: result.stage1.capitalOutlayEtb,
    },
    customs: {
      fobValueEtb: result.stage2.fobValueEtb,
      cifAssessedUsdPerKg: result.stage2.cifUsdPerKg,
      totalCifAssessedUsd: result.stage2.totalCifUsd,
      cifBaseEtb: result.stage2.cifBaseEtb,
      vatBaseEtb: result.stage2.vatBaseEtb,
      dutyEtb: result.stage2.dutyEtb,
      scanFeeEtb: result.stage2.scanFeeEtb,
      socialFeeEtb: result.stage2.socialFeeEtb,
      whtEtb: result.stage2.whtEtb,
      vatEtb: result.stage2.vatEtb,
      totalCustomsPaidEtb: result.stage2.totalCustomsPaidEtb,
    },
    bottomLine: {
      totalLocalClearanceEtb: result.stage3.transportAddisEtb,
      grossInvestmentEtb: result.stage3.grossInvestmentEtb,
      netLandedCostEtb: result.stage3.netLandedCostEtb,
      finalUnitCostEtbPerKg: result.stage3.finalLandedUnitCostEtbPerKg,
    },
    sales: {
      targetSellingPriceEtbPerKg: result.stage4.targetSellingPriceEtbPerKg,
      profitPerKgEtb: result.stage4.profitPerKgEtb,
      grossMarginPct: result.stage4.grossMarginPct,
      totalExpectedRevenueEtb: result.stage4.totalExpectedRevenueEtb,
    },
  };
}

/** Prefer saved shipment snapshot totals over a fresh waterfall recompute. */
export function shipmentRowToTradeTransitResult(
  row: ImportShipmentRow,
  inputs: TradeTransitInputs,
  constants: FinanceConstants = DEFAULT_FINANCE_CONSTANTS,
): TradeTransitResult {
  const computed = calculateTradeTransit(inputs, constants);
  const qty = Math.max(inputs.quantityKg, 0);

  const read = (value: unknown): number | null => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const savedCustoms = read(row.total_customs_paid_etb);
  const savedNetLanded = read(row.net_landed_cost_etb);
  const savedUnitCost = read(row.final_landed_unit_cost_etb_per_kg);
  const savedSell = read(row.target_selling_price_etb_per_kg);
  const savedProfit = read(row.profit_per_kg_etb);
  const savedMargin = read(row.gross_margin_pct);
  const savedRevenue = read(row.total_expected_revenue_etb);

  const unitCost =
    savedUnitCost != null && savedUnitCost > 0
      ? savedUnitCost
      : computed.stage3.finalLandedUnitCostEtbPerKg;
  const netLanded =
    savedNetLanded != null && savedNetLanded > 0
      ? savedNetLanded
      : computed.stage3.netLandedCostEtb;
  const customsPaid =
    savedCustoms != null && savedCustoms > 0
      ? savedCustoms
      : computed.stage2.totalCustomsPaidEtb;
  const sell =
    savedSell != null && savedSell > 0
      ? savedSell
      : computed.stage4.targetSellingPriceEtbPerKg;
  const profit =
    savedProfit != null ? savedProfit : roundFinancial(sell - unitCost, 4);
  const margin =
    savedMargin != null
      ? savedMargin
      : sell > 0
        ? roundFinancial((profit / sell) * 100, 2)
        : 0;
  const revenue =
    savedRevenue != null && savedRevenue > 0
      ? savedRevenue
      : roundFinancial(sell * qty, 2);

  return {
    ...computed,
    stage2: {
      ...computed.stage2,
      totalCustomsPaidEtb: customsPaid,
    },
    stage3: {
      ...computed.stage3,
      netLandedCostEtb: netLanded,
      finalLandedUnitCostEtbPerKg: unitCost,
    },
    stage4: {
      ...computed.stage4,
      unitCostEtbPerKg: unitCost,
      targetSellingPriceEtbPerKg: sell,
      profitPerKgEtb: profit,
      grossMarginPct: margin,
      totalExpectedRevenueEtb: revenue,
    },
  };
}
