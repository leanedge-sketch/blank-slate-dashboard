import {
  DEFAULT_FINANCE_CONSTANTS,
  type FinanceConstants,
} from "./importFinanceCalc";

export const CIF_BUFFER_PCT = 0.1;
export const DEFAULT_INLAND_ETB_PER_KG = 20;

export interface TradeTransitInputs {
  quantityKg: number;
  targetSellingPriceEtbPerKg: number;
  supplierBasePriceUsd: number;
  supplierMarginPct: number;
  transportToMoyaleUsdPerKg: number;
  miscBorderCostUsd: number;
  miscBorderReason: string;
  capitalParallelRate: number;
  customsOfficialRate: number;
  baseCustomsReferenceUsd: number;
  taxSpecialGoodsPct: number;
  inlandClearancePerKgEtb: number;
}

export interface TradeTransitResult {
  stage1: {
    materialUsdPerKg: number;
    transportUsdPerKg: number;
    miscBorderUsdTotal: number;
    borderUsdPerKg: number;
    totalBorderUsd: number;
    capitalParallelRate: number;
    capitalOutlayEtb: number;
  };
  stage2: {
    cifUsdPerKg: number;
    totalCifUsd: number;
    customsOfficialRate: number;
    cifBaseEtb: number;
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
    targetSellingPriceEtbPerKg: number;
    profitPerKgEtb: number;
    grossMarginPct: number;
    totalExpectedRevenueEtb: number;
  };
}

export const DEFAULT_TRADE_TRANSIT_INPUTS: TradeTransitInputs = {
  quantityKg: 20000,
  targetSellingPriceEtbPerKg: 185,
  supplierBasePriceUsd: 0.9,
  supplierMarginPct: 10,
  transportToMoyaleUsdPerKg: 0.14,
  miscBorderCostUsd: 0,
  miscBorderReason: "",
  capitalParallelRate: 190,
  customsOfficialRate: 156,
  baseCustomsReferenceUsd: 0.792,
  taxSpecialGoodsPct: 0,
  inlandClearancePerKgEtb: DEFAULT_INLAND_ETB_PER_KG,
};

export function calculateTradeTransit(
  inputs: TradeTransitInputs,
  constants: FinanceConstants = DEFAULT_FINANCE_CONSTANTS,
): TradeTransitResult {
  const qty = Math.max(inputs.quantityKg, 0);
  const marginFactor = 1 + inputs.supplierMarginPct / 100;

  const materialUsdPerKg = inputs.supplierBasePriceUsd * marginFactor;
  const transportUsdPerKg = inputs.transportToMoyaleUsdPerKg;
  const miscBorderUsdTotal = Math.max(inputs.miscBorderCostUsd, 0);
  const borderUsdPerKg = materialUsdPerKg + transportUsdPerKg;
  const totalBorderUsd = borderUsdPerKg * qty + miscBorderUsdTotal;
  const capitalOutlayEtb = totalBorderUsd * inputs.capitalParallelRate;

  const cifUsdPerKg = inputs.baseCustomsReferenceUsd * (1 + CIF_BUFFER_PCT);
  const totalCifUsd = cifUsdPerKg * qty;
  const cifBaseEtb = totalCifUsd * inputs.customsOfficialRate;

  const dutyEtb = cifBaseEtb * constants.customsDutyPct;
  const scanFeeEtb = cifBaseEtb * constants.scanFeePct;
  const socialFeeEtb = cifBaseEtb * constants.socialFeePct;
  const specialGoodsEtb = cifBaseEtb * (inputs.taxSpecialGoodsPct / 100);
  const whtEtb = cifBaseEtb * constants.whtPct;
  const vatEtb = cifBaseEtb * constants.vatPct;
  const surtaxEtb = 0;
  const exciseEtb = 0;
  const totalCustomsPaidEtb =
    dutyEtb +
    scanFeeEtb +
    socialFeeEtb +
    specialGoodsEtb +
    whtEtb +
    vatEtb +
    surtaxEtb +
    exciseEtb;

  const inlandTransportEtb = qty * inputs.inlandClearancePerKgEtb;
  const grossInvestmentEtb =
    capitalOutlayEtb + totalCustomsPaidEtb + inlandTransportEtb;
  const refundableWhtVatEtb = whtEtb + vatEtb;
  const netLandedCostEtb = grossInvestmentEtb - refundableWhtVatEtb;
  const finalLandedUnitCostEtbPerKg =
    qty > 0 ? netLandedCostEtb / qty : 0;

  const targetPrice = Math.max(inputs.targetSellingPriceEtbPerKg, 0);
  const profitPerKgEtb = targetPrice - finalLandedUnitCostEtbPerKg;
  const grossMarginPct =
    targetPrice > 0 ? (profitPerKgEtb / targetPrice) * 100 : 0;

  return {
    stage1: {
      materialUsdPerKg,
      transportUsdPerKg,
      miscBorderUsdTotal,
      borderUsdPerKg,
      totalBorderUsd,
      capitalParallelRate: inputs.capitalParallelRate,
      capitalOutlayEtb,
    },
    stage2: {
      cifUsdPerKg,
      totalCifUsd,
      customsOfficialRate: inputs.customsOfficialRate,
      cifBaseEtb,
      dutyEtb,
      scanFeeEtb,
      socialFeeEtb,
      specialGoodsEtb,
      whtEtb,
      vatEtb,
      surtaxEtb,
      exciseEtb,
      totalCustomsPaidEtb,
    },
    stage3: {
      inlandTransportEtb,
      grossInvestmentEtb,
      refundableWhtVatEtb,
      netLandedCostEtb,
      finalLandedUnitCostEtbPerKg,
    },
    stage4: {
      targetSellingPriceEtbPerKg: targetPrice,
      profitPerKgEtb,
      grossMarginPct,
      totalExpectedRevenueEtb: targetPrice * qty,
    },
  };
}

/** Map legacy Supabase shipment row to V2 trade transit inputs. */
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
  return {
    quantityKg: Number(row.quantity_kg),
    targetSellingPriceEtbPerKg: Number(row.target_selling_price_etb_per_kg ?? 0),
    supplierBasePriceUsd: Number(row.supplier_base_price_usd),
    supplierMarginPct: Number(row.supplier_margin_pct),
    transportToMoyaleUsdPerKg: Number(row.transport_to_border_usd),
    miscBorderCostUsd: 0,
    miscBorderReason: "",
    capitalParallelRate: Number(row.snapshot_parallel_rate),
    customsOfficialRate: Number(row.snapshot_official_rate),
    baseCustomsReferenceUsd: Number(row.snapshot_base_customs_reference_usd ?? 0),
    taxSpecialGoodsPct: 0,
    inlandClearancePerKgEtb: Number(
      row.local_clearance_per_kg_etb ?? DEFAULT_INLAND_ETB_PER_KG,
    ),
  };
}

/** Map V2 inputs to legacy import finance shape for existing Supabase saves. */
export function tradeTransitToLegacyInputs(
  inputs: TradeTransitInputs,
): import("./importFinanceCalc").ImportFinanceInputs {
  return {
    quantityKg: inputs.quantityKg,
    officialRate: inputs.customsOfficialRate,
    parallelRate: inputs.capitalParallelRate,
    supplierBasePriceUsd: inputs.supplierBasePriceUsd,
    supplierMarginPct: inputs.supplierMarginPct,
    transportToBorderUsdPerKg: inputs.transportToMoyaleUsdPerKg,
    baseCustomsReferenceUsd: inputs.baseCustomsReferenceUsd,
    targetSellingPriceEtbPerKg: inputs.targetSellingPriceEtbPerKg,
  };
}
