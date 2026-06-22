import type { TradeTransitInputs, TradeTransitResult } from "./tradeTransitCalc";
import { roundFinancial } from "./tradeTransitCalc";

export type TransitUom = "KG" | "MT" | "L" | "Bag" | "Carton" | "Drum";

/** Per-unit landed cost split for accountant review (ETB per UOM). */
export interface TransitCostBreakdown {
  fobPrice: number;
  freightCost: number;
  insuranceCost: number;
  customsDuty: number;
  /** Bank, clearance, inland, profit tax — grouped per unit when not in the four core buckets. */
  otherLandedPerUnit: number;
}

export interface TransitFinancialContext {
  exchangeRate: number;
  baseCurrency: string;
  targetCurrency: string;
  isVatInclusive: boolean;
  quoteAsOfDate: string;
}

/** Enterprise summary row for Transit Summary accounting view. */
export interface TransitRequestItem {
  lineId: string;
  productName: string;
  quantity: number;
  uom: TransitUom;
  costBreakdown: TransitCostBreakdown;
  landedPerUnit: number;
  totalCost: number;
  sellingPerUnit: number;
  profitPerUnit: number;
  marginPct: number;
  revenue: number;
  financial: TransitFinancialContext;
}

export interface TransitRequestFinancialTotals {
  quantityKg: number;
  capitalOutlayEtb: number;
  customsPaidEtb: number;
  totalCost: number;
  totalRevenue: number;
  netProfit: number;
}

export function marginPctFromSelling(
  profitPerUnit: number,
  sellingPerUnit: number,
): number {
  if (sellingPerUnit <= 0) return 0;
  return roundFinancial((profitPerUnit / sellingPerUnit) * 100, 2);
}

export function mapTransitRequestItem(
  lineId: string,
  productName: string,
  inputs: TradeTransitInputs,
  result: TradeTransitResult,
  options?: {
    uom?: TransitUom;
    quoteAsOfDate?: string;
    isVatInclusive?: boolean;
  },
): TransitRequestItem {
  const qty = Math.max(inputs.quantityKg, 0);
  const uom = options?.uom ?? "KG";

  const fobTotal = result.stage2.fobValueEtb;
  const freightTotal =
    qty * inputs.transportToMoyaleUsdPerKg * inputs.capitalParallelRate +
    result.stage3.transportAddisEtb +
    result.stage1.miscBorderUsdTotal * inputs.capitalParallelRate;
  const insuranceTotal = result.stage3.insuranceEtb;
  const customsTotal = result.stage2.totalCustomsPaidEtb;

  const fobPrice = qty > 0 ? roundFinancial(fobTotal / qty, 4) : 0;
  const freightCost = qty > 0 ? roundFinancial(freightTotal / qty, 4) : 0;
  const insuranceCost = qty > 0 ? roundFinancial(insuranceTotal / qty, 4) : 0;
  const customsDuty = qty > 0 ? roundFinancial(customsTotal / qty, 4) : 0;

  const coreSum = fobPrice + freightCost + insuranceCost + customsDuty;
  const landedPerUnit = result.stage3.finalLandedUnitCostEtbPerKg;
  const otherLandedPerUnit = roundFinancial(
    Math.max(landedPerUnit - coreSum, 0),
    4,
  );

  const sellingPerUnit = result.stage4.targetSellingPriceEtbPerKg;
  const profitPerUnit = result.stage4.profitPerKgEtb;
  const marginPct = marginPctFromSelling(profitPerUnit, sellingPerUnit);

  return {
    lineId,
    productName,
    quantity: qty,
    uom,
    costBreakdown: {
      fobPrice,
      freightCost,
      insuranceCost,
      customsDuty,
      otherLandedPerUnit,
    },
    landedPerUnit,
    totalCost: result.stage3.netLandedCostEtb,
    sellingPerUnit,
    profitPerUnit,
    marginPct,
    revenue: result.stage4.totalExpectedRevenueEtb,
    financial: {
      exchangeRate: inputs.capitalParallelRate,
      baseCurrency: "USD",
      targetCurrency: "ETB",
      isVatInclusive: options?.isVatInclusive ?? false,
      quoteAsOfDate:
        options?.quoteAsOfDate ?? new Date().toISOString().slice(0, 10),
    },
  };
}

export function aggregateTransitFinancialTotals(
  items: TransitRequestItem[],
  legacy?: {
    capitalOutlayEtb?: number;
    customsPaidEtb?: number;
    quantityKg?: number;
  },
): TransitRequestFinancialTotals {
  const totalCost = roundFinancial(
    items.reduce((sum, item) => sum + item.totalCost, 0),
    2,
  );
  const totalRevenue = roundFinancial(
    items.reduce((sum, item) => sum + item.revenue, 0),
    2,
  );

  return {
    quantityKg:
      legacy?.quantityKg ??
      items.reduce((sum, item) => sum + item.quantity, 0),
    capitalOutlayEtb: legacy?.capitalOutlayEtb ?? 0,
    customsPaidEtb:
      legacy?.customsPaidEtb ??
      items.reduce(
        (sum, item) => sum + item.costBreakdown.customsDuty * item.quantity,
        0,
      ),
    totalCost,
    totalRevenue,
    netProfit: roundFinancial(totalRevenue - totalCost, 2),
  };
}
