export type DateRangePreset = "ytd" | "last90" | "thisMonth";

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
  originOutlayEtb: number;
  customsEtb: number;
  transitEtb: number;
  profitEtb: number;
  revenueEtb: number;
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
  tone: "global" | "product" | "customer";
};
