import type { PricingLocation, PricingRecord, PricingRecordInput } from "../components/pms/pricing-costing/types";
import type { CRMPartner } from "../components/pms/pricing-costing/types";
import type { TradeParameters } from "../types/tradeParameters";
import type { ImportShipmentRow } from "../services/importFinance";
import type { TradeTransitInputs } from "./tradeTransitCalc";
import type { TradeTransitRequestLine } from "./tradeTransitRequest";
import type { TradeTransitResult } from "./tradeTransitCalc";

export type TradeTransitPricingSnapshot = {
  landedCostEtbPerKg: number | null;
  sellingPriceEtbPerKg: number | null;
  savedAt: string;
  requestRef: string | null;
};

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function resolveCrmPartnerByClientName(
  partners: CRMPartner[],
  clientName: string,
): CRMPartner | null {
  const needle = normalizeKey(clientName);
  if (!needle) return null;

  const buyers = partners.filter((p) => p.type === "buyer" && p.partnerKind === "crm");
  const exact = buyers.find((p) => normalizeKey(p.name) === needle);
  if (exact) return exact;

  const contains = buyers.find(
    (p) =>
      normalizeKey(p.name).includes(needle) || needle.includes(normalizeKey(p.name)),
  );
  return contains ?? null;
}

export function tradeTransitSnapshotKey(
  clientName: string,
  pmsProductId: string,
): string {
  return `${normalizeKey(clientName)}|${pmsProductId.trim()}`;
}

export function buildTradeTransitSnapshotIndex(
  shipments: ImportShipmentRow[],
): Map<string, TradeTransitPricingSnapshot> {
  const map = new Map<string, TradeTransitPricingSnapshot>();
  for (const row of shipments) {
    const productId = row.chemical_type_id?.trim();
    const clientName = row.client_name?.trim();
    if (!productId || !clientName) continue;
    const key = tradeTransitSnapshotKey(clientName, productId);
    if (map.has(key)) continue;
    map.set(key, {
      landedCostEtbPerKg:
        row.final_landed_unit_cost_etb_per_kg != null
          ? Number(row.final_landed_unit_cost_etb_per_kg)
          : null,
      sellingPriceEtbPerKg:
        row.target_selling_price_etb_per_kg != null
          ? Number(row.target_selling_price_etb_per_kg)
          : null,
      savedAt: row.created_at,
      requestRef: row.request_ref ?? null,
    });
  }
  return map;
}

export function pickPricingLocation(
  locations: PricingLocation[],
  parameters: TradeParameters,
): PricingLocation | null {
  if (locations.length === 0) return null;

  const discharge = normalizeKey(parameters.portOfDischarge);
  const loading = normalizeKey(parameters.portOfLoading);

  const byDischarge = locations.find((loc) => {
    const label = normalizeKey(
      [loc.country, loc.city, loc.port].filter(Boolean).join(" "),
    );
    return discharge && label.includes(discharge);
  });
  if (byDischarge) return byDischarge;

  const byLoading = locations.find((loc) => {
    const label = normalizeKey(
      [loc.country, loc.city, loc.port].filter(Boolean).join(" "),
    );
    return loading && label.includes(loading);
  });
  if (byLoading) return byLoading;

  const ethiopia =
    locations.find((loc) => normalizeKey(loc.country) === "ethiopia") ??
  locations.find((loc) => normalizeKey(loc.country).includes("ethiopia"));
  return ethiopia ?? locations[0] ?? null;
}

function currencyAmountToUsd(amount: number, currency: string, fxRate: number): number {
  const code = currency.trim().toUpperCase();
  if (code === "USD") return amount;
  if (code === "ETB" && fxRate > 0) return amount / fxRate;
  return amount;
}

function currencyAmountToEtb(amount: number, currency: string, fxRate: number): number {
  const code = currency.trim().toUpperCase();
  if (code === "ETB") return amount;
  if (code === "USD" && fxRate > 0) return amount * fxRate;
  return amount;
}

export function applyPricingRecordToTradeTransitInputs(
  record: PricingRecord,
  inputs: TradeTransitInputs,
  parameters: TradeParameters,
): Partial<TradeTransitInputs> {
  const fx =
    record.exchangeRateUsed && record.exchangeRateUsed > 0
      ? record.exchangeRateUsed
      : parameters.exchangeRate > 0
        ? parameters.exchangeRate
        : inputs.capitalParallelRate;

  const supplierBasePriceUsd = currencyAmountToUsd(
    record.costAmount,
    record.costCurrency,
    fx,
  );

  const targetSellingPriceEtbPerKg = currencyAmountToEtb(
    record.priceAmount,
    record.priceCurrency,
    fx,
  );

  return {
    supplierBasePriceUsd,
    targetSellingPriceEtbPerKg,
    sellingPriceMode: "manual",
    capitalParallelRate: fx,
  };
}

export function buildPricingRecordFromTradeTransitLine(
  line: TradeTransitRequestLine,
  result: TradeTransitResult,
  partner: CRMPartner,
  location: PricingLocation,
  parameters: TradeParameters,
): PricingRecordInput {
  const fx = parameters.exchangeRate > 0 ? parameters.exchangeRate : line.inputs.capitalParallelRate;
  const costCurrency = (parameters.baseCurrency || "USD").toString().toUpperCase();
  const priceCurrency = (parameters.targetCurrency || "ETB").toString().toUpperCase();
  const costAmount = line.inputs.supplierBasePriceUsd;
  const priceAmount =
    result.stage4.targetSellingPriceEtbPerKg > 0
      ? result.stage4.targetSellingPriceEtbPerKg
      : line.inputs.targetSellingPriceEtbPerKg;

  const needsCurrencyConversion = costCurrency !== priceCurrency;

  return {
    crmPartnerId: partner.id,
    partnerKind: partner.partnerKind,
    supplierPartnerId: null,
    pmsProductId: line.chemicalTypeId!,
    incoterm: String(parameters.incoterm || "FOB"),
    locationId: location.id,
    costCurrency,
    costAmount,
    priceCurrency,
    priceAmount,
    needsCurrencyConversion,
    exchangeRateUsed: needsCurrencyConversion ? fx : null,
    baseCurrency: needsCurrencyConversion ? costCurrency : null,
  };
}

export function comparePricingRecordsForSelection(
  a: PricingRecord,
  b: PricingRecord,
): number {
  if (a.status === "active" && b.status !== "active") return -1;
  if (b.status === "active" && a.status !== "active") return 1;
  return (b.validFrom ?? "").localeCompare(a.validFrom ?? "");
}
