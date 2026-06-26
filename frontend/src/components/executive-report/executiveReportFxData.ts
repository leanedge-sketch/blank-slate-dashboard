import { formatEtbCompact } from "./executiveReportData";
import type {
  CurrencyLedgerRow,
  CustomerCurrency,
  CustomerFxMatrixRow,
  EnrichedShipment,
  FxKpiSummary,
  FxSpreadSeriesPoint,
  MarginByCurrencyPoint,
} from "./executiveReportTypes";

export const FX_COLORS = {
  USD: "#3b82f6",
  ETB: "#f59e0b",
} as const;

function avgMargin(shipments: EnrichedShipment[]): number {
  if (shipments.length === 0) return 0;
  return shipments.reduce((sum, s) => sum + s.marginPct, 0) / shipments.length;
}

function revenueForCurrency(s: EnrichedShipment): number {
  return s.currency === "USD" ? s.revenueUsd : s.revenueEtb;
}

export function buildFxKpis(shipments: EnrichedShipment[]): FxKpiSummary {
  const usdRows = shipments.filter((s) => s.currency === "USD");
  const etbRows = shipments.filter((s) => s.currency === "ETB");

  const totalUsdRevenue = usdRows.reduce((sum, s) => sum + s.revenueUsd, 0);
  const totalEtbRevenue = etbRows.reduce((sum, s) => sum + s.revenueEtb, 0);
  const usdAvgMarginPct = avgMargin(usdRows);
  const etbAvgMarginPct = avgMargin(etbRows);

  const totalWeight = usdRows.length + etbRows.length;
  const blendedMarginPct =
    totalWeight > 0
      ? (usdAvgMarginPct * usdRows.length + etbAvgMarginPct * etbRows.length) /
        totalWeight
      : 0;

  return {
    totalUsdRevenue,
    totalEtbRevenue,
    usdAvgMarginPct,
    etbAvgMarginPct,
    blendedMarginPct,
  };
}

export function buildMarginByCurrency(
  shipments: EnrichedShipment[],
): MarginByCurrencyPoint[] {
  const currencies: CustomerCurrency[] = ["USD", "ETB"];
  return currencies.map((currency) => {
    const rows = shipments.filter((s) => s.currency === currency);
    return {
      currency,
      label: currency,
      avgMarginPct: avgMargin(rows),
      shipmentCount: rows.length,
    };
  });
}

export function buildCustomerFxMatrix(
  shipments: EnrichedShipment[],
  limit = 10,
): CustomerFxMatrixRow[] {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      usdRevenueEtb: number;
      etbRevenueEtb: number;
    }
  >();

  for (const s of shipments) {
    const existing = map.get(s.customerId);
    const addUsd = s.currency === "USD" ? s.revenueEtb : 0;
    const addEtb = s.currency === "ETB" ? s.revenueEtb : 0;
    if (!existing) {
      map.set(s.customerId, {
        id: s.customerId,
        name: s.customerName,
        usdRevenueEtb: addUsd,
        etbRevenueEtb: addEtb,
      });
      continue;
    }
    map.set(s.customerId, {
      ...existing,
      usdRevenueEtb: existing.usdRevenueEtb + addUsd,
      etbRevenueEtb: existing.etbRevenueEtb + addEtb,
    });
  }

  return [...map.values()]
    .map((row) => {
      const totalRevenueEtb = row.usdRevenueEtb + row.etbRevenueEtb;
      return {
        ...row,
        totalRevenueEtb,
        usdSharePct:
          totalRevenueEtb > 0 ? (row.usdRevenueEtb / totalRevenueEtb) * 100 : 0,
        etbSharePct:
          totalRevenueEtb > 0 ? (row.etbRevenueEtb / totalRevenueEtb) * 100 : 0,
      };
    })
    .sort((a, b) => b.totalRevenueEtb - a.totalRevenueEtb)
    .slice(0, limit);
}

export function buildFxSpreadSeries(
  shipments: EnrichedShipment[],
): FxSpreadSeriesPoint[] {
  const buckets = new Map<
    string,
    {
      period: string;
      label: string;
      spreadSum: number;
      spreadCount: number;
      etbMargins: number[];
    }
  >();

  for (const s of shipments) {
    const d = new Date(s.createdAt);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    const existing = buckets.get(period);
    if (!existing) {
      buckets.set(period, {
        period,
        label,
        spreadSum: s.fxSpread,
        spreadCount: 1,
        etbMargins: s.currency === "ETB" ? [s.marginPct] : [],
      });
      continue;
    }
    buckets.set(period, {
      ...existing,
      spreadSum: existing.spreadSum + s.fxSpread,
      spreadCount: existing.spreadCount + 1,
      etbMargins:
        s.currency === "ETB"
          ? [...existing.etbMargins, s.marginPct]
          : existing.etbMargins,
    });
  }

  return [...buckets.values()]
    .map((bucket) => ({
      period: bucket.period,
      label: bucket.label,
      fxSpread:
        bucket.spreadCount > 0 ? bucket.spreadSum / bucket.spreadCount : 0,
      etbMarginPct:
        bucket.etbMargins.length > 0
          ? bucket.etbMargins.reduce((a, b) => a + b, 0) / bucket.etbMargins.length
          : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export function buildCurrencyLedger(
  shipments: EnrichedShipment[],
): CurrencyLedgerRow[] {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      totalVolumeKg: number;
      marginSum: number;
      count: number;
      totalRevenueEtb: number;
      usdRevenueEtb: number;
    }
  >();

  for (const s of shipments) {
    const existing = map.get(s.customerId);
    if (!existing) {
      map.set(s.customerId, {
        id: s.customerId,
        name: s.customerName,
        totalVolumeKg: s.quantityKg,
        marginSum: s.marginPct,
        count: 1,
        totalRevenueEtb: s.revenueEtb,
        usdRevenueEtb: s.currency === "USD" ? s.revenueEtb : 0,
      });
      continue;
    }
    const count = existing.count + 1;
    map.set(s.customerId, {
      ...existing,
      totalVolumeKg: existing.totalVolumeKg + s.quantityKg,
      marginSum: existing.marginSum + s.marginPct,
      count,
      totalRevenueEtb: existing.totalRevenueEtb + s.revenueEtb,
      usdRevenueEtb:
        existing.usdRevenueEtb + (s.currency === "USD" ? s.revenueEtb : 0),
    });
  }

  return [...map.values()]
    .map((row) => {
      const usdSharePct =
        row.totalRevenueEtb > 0 ? (row.usdRevenueEtb / row.totalRevenueEtb) * 100 : 0;
      return {
        id: row.id,
        name: row.name,
        dominantCurrency: usdSharePct >= 50 ? "USD" : "ETB",
        totalVolumeKg: row.totalVolumeKg,
        avgMarginPct: row.marginSum / row.count,
        totalRevenueEtb: row.totalRevenueEtb,
        usdSharePct,
      };
    })
    .sort((a, b) => b.totalRevenueEtb - a.totalRevenueEtb);
}

export function formatUsdCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatFxKpiLabel(kpis: FxKpiSummary): string {
  return `USD ${formatUsdCompact(kpis.totalUsdRevenue)} · ETB ${formatEtbCompact(kpis.totalEtbRevenue)}`;
}

export { revenueForCurrency };
