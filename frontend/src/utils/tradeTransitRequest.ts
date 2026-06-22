import type { FinanceConstants } from "./importFinanceCalc";
import {
  aggregateTransitFinancialTotals,
  mapTransitRequestItem,
  type TransitRequestFinancialTotals,
  type TransitRequestItem,
} from "./transitRequestItem";
import {
  calculateTradeTransit,
  DEFAULT_TRADE_TRANSIT_INPUTS,
  type TradeTransitInputs,
  type TradeTransitResult,
} from "./tradeTransitCalc";

export interface TradeTransitRequestLine {
  id: string;
  productName: string;
  /** PMS chemical_full_data catalog ref (uuid_id when available). */
  chemicalTypeId: string | null;
  /** Resolved import_finance_products.id for Supabase save. */
  productId: string | null;
  inputs: TradeTransitInputs;
}

export interface TradeTransitRequest {
  clientName: string;
  requestRef: string;
  lines: TradeTransitRequestLine[];
}

/** FX and tax rates typically shared across products on one client request. */
export type SharedTradeTransitRates = Pick<
  TradeTransitInputs,
  | "capitalParallelRate"
  | "customsOfficialRate"
  | "cifBufferPct"
  | "customsDutyPct"
  | "scanFeePct"
  | "socialFeePct"
  | "whtPct"
  | "vatPct"
  | "surtaxPct"
  | "excisePct"
  | "taxSpecialGoodsPct"
  | "bankChargePctOnCapital"
  | "profitTaxPctOnPreLanded"
>;

export interface TradeTransitLineSummary {
  lineId: string;
  productName: string;
  result: TradeTransitResult;
}

export interface TradeTransitRequestSummary {
  lines: TradeTransitLineSummary[];
  items: TransitRequestItem[];
  totals: TransitRequestFinancialTotals & {
    /** @deprecated use totals.totalCost */
    landedCostEtb: number;
    /** @deprecated use totals.totalRevenue */
    expectedRevenueEtb: number;
  };
}

export type {
  TransitCostBreakdown,
  TransitFinancialContext,
  TransitRequestFinancialTotals,
  TransitRequestItem,
  TransitUom,
} from "./transitRequestItem";

export function createTradeTransitLineId(): string {
  return `ttl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function sharedRatesFromInputs(
  inputs: TradeTransitInputs,
): SharedTradeTransitRates {
  return {
    capitalParallelRate: inputs.capitalParallelRate,
    customsOfficialRate: inputs.customsOfficialRate,
    cifBufferPct: inputs.cifBufferPct,
    customsDutyPct: inputs.customsDutyPct,
    scanFeePct: inputs.scanFeePct,
    socialFeePct: inputs.socialFeePct,
    whtPct: inputs.whtPct,
    vatPct: inputs.vatPct,
    surtaxPct: inputs.surtaxPct,
    excisePct: inputs.excisePct,
    taxSpecialGoodsPct: inputs.taxSpecialGoodsPct,
    bankChargePctOnCapital: inputs.bankChargePctOnCapital,
    profitTaxPctOnPreLanded: inputs.profitTaxPctOnPreLanded,
  };
}

export function createTradeTransitLine(
  productName: string,
  partial?: Partial<TradeTransitInputs> & {
    productId?: string | null;
    chemicalTypeId?: string | null;
  },
): TradeTransitRequestLine {
  const { productId = null, chemicalTypeId = null, ...inputPatch } = partial ?? {};
  return {
    id: createTradeTransitLineId(),
    productName,
    chemicalTypeId,
    productId,
    inputs: {
      ...DEFAULT_TRADE_TRANSIT_INPUTS,
      ...inputPatch,
    },
  };
}

export function createTradeTransitRequest(
  clientName = "",
  lines?: TradeTransitRequestLine[],
): TradeTransitRequest {
  return {
    clientName,
    requestRef: "",
    lines: lines ?? [createTradeTransitLine("Product 1")],
  };
}

export function applySharedRatesToLine(
  line: TradeTransitRequestLine,
  shared: SharedTradeTransitRates,
): TradeTransitRequestLine {
  return {
    ...line,
    inputs: { ...line.inputs, ...shared },
  };
}

export function syncSharedRatesAcrossRequest(
  request: TradeTransitRequest,
  shared: SharedTradeTransitRates,
): TradeTransitRequest {
  return {
    ...request,
    lines: request.lines.map((line) => applySharedRatesToLine(line, shared)),
  };
}

export function summarizeTradeTransitRequest(
  request: TradeTransitRequest,
  constants: FinanceConstants,
): TradeTransitRequestSummary {
  const lines = request.lines.map((line) => ({
    lineId: line.id,
    productName: line.productName,
    result: calculateTradeTransit(line.inputs, constants),
  }));

  const quoteAsOfDate = new Date().toISOString().slice(0, 10);
  const items = request.lines.map((line, index) =>
    mapTransitRequestItem(
      line.id,
      line.productName,
      line.inputs,
      lines[index]!.result,
      { quoteAsOfDate },
    ),
  );

  const legacyTotals = lines.reduce(
    (acc, entry, index) => ({
      quantityKg:
        acc.quantityKg + Math.max(request.lines[index]?.inputs.quantityKg ?? 0, 0),
      capitalOutlayEtb: acc.capitalOutlayEtb + entry.result.stage1.capitalOutlayEtb,
      customsPaidEtb:
        acc.customsPaidEtb + entry.result.stage2.totalCustomsPaidEtb,
      landedCostEtb: acc.landedCostEtb + entry.result.stage3.netLandedCostEtb,
      expectedRevenueEtb:
        acc.expectedRevenueEtb + entry.result.stage4.totalExpectedRevenueEtb,
    }),
    {
      quantityKg: 0,
      capitalOutlayEtb: 0,
      customsPaidEtb: 0,
      landedCostEtb: 0,
      expectedRevenueEtb: 0,
    },
  );

  const financialTotals = aggregateTransitFinancialTotals(items, {
    quantityKg: legacyTotals.quantityKg,
    capitalOutlayEtb: legacyTotals.capitalOutlayEtb,
    customsPaidEtb: legacyTotals.customsPaidEtb,
  });

  return {
    lines,
    items,
    totals: {
      ...financialTotals,
      landedCostEtb: legacyTotals.landedCostEtb,
      expectedRevenueEtb: legacyTotals.expectedRevenueEtb,
    },
  };
}

export function scenariosToTradeTransitRequest(
  scenarios: Array<{ id: string; name: string; inputs: TradeTransitInputs }>,
  clientName: string,
): TradeTransitRequest {
  if (scenarios.length === 0) {
    return createTradeTransitRequest(clientName);
  }

  const shared = sharedRatesFromInputs(scenarios[0].inputs);
  const lines = scenarios.map((scenario) =>
    applySharedRatesToLine(
      createTradeTransitLine(scenario.name, {
        ...scenario.inputs,
        productId: null,
        chemicalTypeId: null,
      }),
      shared,
    ),
  );

  return {
    clientName,
    requestRef: scenarios.length > 1 ? "multi-product" : scenarios[0].id,
    lines,
  };
}
