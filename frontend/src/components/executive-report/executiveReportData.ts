import type { ImportFinanceProduct, ImportShipmentRow } from "../../services/importFinance";
import type {
  CostStructureSlice,
  CustomerEfficiencyPoint,
  CustomerLedgerRow,
  CustomerSortMode,
  DateRangePreset,
  EnrichedShipment,
  ProductLedgerRow,
  ProductSortMode,
  RevenueMarginPoint,
  SelectedEntity,
} from "./executiveReportTypes";

const COST_COLORS = {
  origin: "#22d3ee",
  customs: "#fbbf24",
  transit: "#a78bfa",
  profit: "#34d399",
};

export function resolveDateRange(preset: DateRangePreset): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  if (preset === "ytd") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "last90") {
    start.setDate(start.getDate() - 90);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

export function formatRangeLabel(preset: DateRangePreset): string {
  if (preset === "ytd") return "Year to date";
  if (preset === "last90") return "Last 90 days";
  return "This month";
}

function customerKey(row: ImportShipmentRow): string {
  if (row.customer_id?.trim()) return `cid:${row.customer_id.trim()}`;
  const name = row.client_name?.trim();
  return name ? `name:${name.toLowerCase()}` : "unknown";
}

function customerLabel(row: ImportShipmentRow): string {
  return row.client_name?.trim() || "Unassigned buyer";
}

export function enrichShipments(
  rows: ImportShipmentRow[],
  products: ImportFinanceProduct[],
  range: DateRangePreset,
): EnrichedShipment[] {
  const { start, end } = resolveDateRange(range);
  const productMap = new Map(products.map((p) => [p.id, p.product_name]));

  return rows
    .filter((row) => {
      const d = new Date(row.created_at);
      return d >= start && d <= end;
    })
    .map((row) => {
      const qty = Number(row.quantity_kg) || 0;
      const profitPerKg = Number(row.profit_per_kg_etb) || 0;
      const revenue = Number(row.total_expected_revenue_etb) || 0;
      const landed = Number(row.net_landed_cost_etb) || 0;
      const profit =
        profitPerKg > 0
          ? profitPerKg * qty
          : Math.max(0, revenue - landed);

      return {
        id: row.id,
        productId: row.product_id,
        productName:
          productMap.get(row.product_id) ?? `Product ${row.product_id.slice(0, 8)}`,
        customerId: customerKey(row),
        customerName: customerLabel(row),
        quantityKg: qty,
        createdAt: row.created_at,
        originOutlayEtb: Number(row.capital_outlay_etb) || 0,
        customsEtb: Number(row.total_customs_paid_etb) || 0,
        transitEtb: Number(row.inland_transport_etb) || 0,
        profitEtb: profit,
        revenueEtb: revenue,
        landedCostEtb: landed,
        marginPct: Number(row.gross_margin_pct) || 0,
        profitPerKgEtb: profitPerKg,
      };
    });
}

export function filterByEntity(
  shipments: EnrichedShipment[],
  entity: SelectedEntity,
): EnrichedShipment[] {
  if (!entity) return shipments;
  if (entity.type === "product") {
    return shipments.filter((s) => s.productId === entity.id);
  }
  return shipments.filter((s) => s.customerId === entity.id);
}

export function buildProductLedger(
  shipments: EnrichedShipment[],
  sort: ProductSortMode,
): ProductLedgerRow[] {
  const map = new Map<string, ProductLedgerRow>();

  for (const s of shipments) {
    const existing = map.get(s.productId);
    if (!existing) {
      map.set(s.productId, {
        id: s.productId,
        name: s.productName,
        shipmentCount: 1,
        totalProfitEtb: s.profitEtb,
        totalVolumeKg: s.quantityKg,
        avgMarginPct: s.marginPct,
      });
      continue;
    }
    const count = existing.shipmentCount + 1;
    map.set(s.productId, {
      ...existing,
      shipmentCount: count,
      totalProfitEtb: existing.totalProfitEtb + s.profitEtb,
      totalVolumeKg: existing.totalVolumeKg + s.quantityKg,
      avgMarginPct:
        (existing.avgMarginPct * existing.shipmentCount + s.marginPct) / count,
    });
  }

  const rows = [...map.values()];
  rows.sort((a, b) =>
    sort === "frequency"
      ? b.shipmentCount - a.shipmentCount
      : b.totalProfitEtb - a.totalProfitEtb,
  );
  return rows;
}

export function buildCustomerLedger(
  shipments: EnrichedShipment[],
  sort: CustomerSortMode,
): CustomerLedgerRow[] {
  const map = new Map<string, CustomerLedgerRow>();

  for (const s of shipments) {
    const existing = map.get(s.customerId);
    if (!existing) {
      map.set(s.customerId, {
        id: s.customerId,
        name: s.customerName,
        totalVolumeKg: s.quantityKg,
        avgMarginPct: s.marginPct,
        totalRevenueEtb: s.revenueEtb,
        shipmentCount: 1,
      });
      continue;
    }
    const count = existing.shipmentCount + 1;
    map.set(s.customerId, {
      ...existing,
      totalVolumeKg: existing.totalVolumeKg + s.quantityKg,
      totalRevenueEtb: existing.totalRevenueEtb + s.revenueEtb,
      shipmentCount: count,
      avgMarginPct:
        (existing.avgMarginPct * existing.shipmentCount + s.marginPct) / count,
    });
  }

  const rows = [...map.values()];
  rows.sort((a, b) =>
    sort === "volume"
      ? b.totalVolumeKg - a.totalVolumeKg
      : b.avgMarginPct - a.avgMarginPct,
  );
  return rows;
}

export function buildCostStructure(shipments: EnrichedShipment[]): CostStructureSlice[] {
  const totals = shipments.reduce(
    (acc, s) => ({
      origin: acc.origin + s.originOutlayEtb,
      customs: acc.customs + s.customsEtb,
      transit: acc.transit + s.transitEtb,
      profit: acc.profit + s.profitEtb,
    }),
    { origin: 0, customs: 0, transit: 0, profit: 0 },
  );

  return [
    { key: "origin", label: "Origin outlay", value: totals.origin, color: COST_COLORS.origin },
    { key: "customs", label: "Customs", value: totals.customs, color: COST_COLORS.customs },
    { key: "transit", label: "Transit", value: totals.transit, color: COST_COLORS.transit },
    { key: "profit", label: "Profit margin", value: totals.profit, color: COST_COLORS.profit },
  ].filter((s) => s.value > 0);
}

export function buildRevenueMarginSeries(
  shipments: EnrichedShipment[],
): RevenueMarginPoint[] {
  const buckets = new Map<string, RevenueMarginPoint>();

  for (const s of shipments) {
    const d = new Date(s.createdAt);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    const existing = buckets.get(period);
    if (!existing) {
      buckets.set(period, {
        period,
        label,
        revenueEtb: s.revenueEtb,
        profitEtb: s.profitEtb,
        marginPct: s.marginPct,
      });
      continue;
    }
    const revenueEtb = existing.revenueEtb + s.revenueEtb;
    const profitEtb = existing.profitEtb + s.profitEtb;
    buckets.set(period, {
      period,
      label: existing.label,
      revenueEtb,
      profitEtb,
      marginPct: revenueEtb > 0 ? (profitEtb / revenueEtb) * 100 : existing.marginPct,
    });
  }

  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export function buildCustomerEfficiency(
  shipments: EnrichedShipment[],
): CustomerEfficiencyPoint[] {
  const ledger = buildCustomerLedger(shipments, "volume");
  return ledger.map((c) => ({
    id: c.id,
    name: c.name,
    volumeKg: c.totalVolumeKg,
    marginPct: c.avgMarginPct,
    revenueEtb: c.totalRevenueEtb,
  }));
}

export function formatEtbCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
