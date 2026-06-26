export type DateRangePreset = "ytd" | "last90" | "thisMonth";

export type ExecutiveDeck = "products" | "customers" | "fx";

export type CustomerCurrency = "USD" | "ETB";

export type SelectedEntity =
  | { type: "product"; id: string; label: string }
  | { type: "customer"; id: string; label: string }
  | null;

export type ProductSortMode = "frequency" | "profit";
export type CustomerSortMode = "volume" | "margin";

export type EnrichedShipment = {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  quantityKg: number;
  createdAt: string;
  currency: CustomerCurrency;
  officialRate: number;
  parallelRate: number;
  fxSpread: number;
  originOutlayEtb: number;
  customsEtb: number;
  transitEtb: number;
  profitEtb: number;
  revenueEtb: number;
  revenueUsd: number;
  landedCostEtb: number;
  marginPct: number;
  profitPerKgEtb: number;
};

export type ProductLedgerRow = {
  id: string;
  name: string;
  shipmentCount: number;
  totalProfitEtb: number;
  totalVolumeKg: number;
  avgMarginPct: number;
};

export type CustomerLedgerRow = {
  id: string;
  name: string;
  totalVolumeKg: number;
  avgMarginPct: number;
  totalRevenueEtb: number;
  shipmentCount: number;
};

export type CostStructureSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export type RevenueMarginPoint = {
  period: string;
  label: string;
  revenueEtb: number;
  marginPct: number;
  profitEtb: number;
};

export type CustomerEfficiencyPoint = {
  id: string;
  name: string;
  volumeKg: number;
  marginPct: number;
  revenueEtb: number;
};

export type CognitiveSummary = {
  bullets: string[];
  headline: string;
  tone: "global" | "product" | "customer" | "fx";
};

export type FxKpiSummary = {
  totalUsdRevenue: number;
  totalEtbRevenue: number;
  usdAvgMarginPct: number;
  etbAvgMarginPct: number;
  blendedMarginPct: number;
};

export type MarginByCurrencyPoint = {
  currency: CustomerCurrency;
  label: string;
  avgMarginPct: number;
  shipmentCount: number;
};

export type CustomerFxMatrixRow = {
  id: string;
  name: string;
  totalRevenueEtb: number;
  usdRevenueEtb: number;
  etbRevenueEtb: number;
  usdSharePct: number;
  etbSharePct: number;
};

export type FxSpreadSeriesPoint = {
  period: string;
  label: string;
  fxSpread: number;
  etbMarginPct: number;
};

export type CurrencyLedgerRow = {
  id: string;
  name: string;
  dominantCurrency: CustomerCurrency;
  totalVolumeKg: number;
  avgMarginPct: number;
  totalRevenueEtb: number;
  usdSharePct: number;
};
