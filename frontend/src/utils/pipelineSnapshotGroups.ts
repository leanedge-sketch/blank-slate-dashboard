import type { ImportFinanceProduct, ImportShipmentRow } from "../services/importFinance";

export type PipelineSnapshotRow = ImportShipmentRow & {
  productLabel: string;
};

export type PipelineSnapshotGroupTotals = {
  quantityKg: number;
  capitalOutlayEtb: number;
  customsEtb: number;
  revenueEtb: number;
  weightedLandedPerKg: number;
  weightedTargetPerKg: number;
  avgMarginPct: number | null;
};

export type PipelineSnapshotGroup = {
  key: string;
  requestRef: string;
  clientName: string;
  contactPerson: string;
  customerId: string | null;
  rows: PipelineSnapshotRow[];
  totals: PipelineSnapshotGroupTotals;
};

function groupKey(row: ImportShipmentRow): string {
  const ref = (row.request_ref ?? "").trim() || "—";
  const client = (row.client_name ?? "").trim() || "Unnamed";
  const customer = (row.customer_id ?? "").trim();
  return `${ref}::${client}::${customer}`;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function computeTotals(rows: PipelineSnapshotRow[]): PipelineSnapshotGroupTotals {
  let quantityKg = 0;
  let capitalOutlayEtb = 0;
  let customsEtb = 0;
  let revenueEtb = 0;
  let landedWeighted = 0;
  let targetWeighted = 0;
  let marginSum = 0;
  let marginCount = 0;

  for (const row of rows) {
    const qty = num(row.quantity_kg);
    quantityKg += qty;
    capitalOutlayEtb += num(row.capital_outlay_etb);
    customsEtb += num(row.total_customs_paid_etb);
    revenueEtb += num(row.total_expected_revenue_etb);

    const landed = num(row.final_landed_unit_cost_etb_per_kg);
    const target = num(row.target_selling_price_etb_per_kg);
    if (qty > 0 && landed > 0) landedWeighted += landed * qty;
    if (qty > 0 && target > 0) targetWeighted += target * qty;

    if (row.gross_margin_pct != null) {
      marginSum += num(row.gross_margin_pct);
      marginCount += 1;
    }
  }

  return {
    quantityKg,
    capitalOutlayEtb,
    customsEtb,
    revenueEtb,
    weightedLandedPerKg: quantityKg > 0 ? landedWeighted / quantityKg : 0,
    weightedTargetPerKg: quantityKg > 0 ? targetWeighted / quantityKg : 0,
    avgMarginPct: marginCount > 0 ? marginSum / marginCount : null,
  };
}

export function groupPipelineSnapshots(
  shipments: ImportShipmentRow[],
  products: ImportFinanceProduct[],
): PipelineSnapshotGroup[] {
  const productById = new Map(products.map((p) => [p.id, p.product_name]));
  const map = new Map<string, PipelineSnapshotRow[]>();

  for (const row of shipments) {
    const key = groupKey(row);
    const list = map.get(key) ?? [];
    list.push({
      ...row,
      productLabel:
        productById.get(row.product_id) ??
        row.chemical_type_id?.slice(0, 8) ??
        row.product_id.slice(0, 8),
    });
    map.set(key, list);
  }

  return [...map.entries()]
    .map(([key, rows]) => {
      const first = rows[0]!;
      return {
        key,
        requestRef: (first.request_ref ?? "").trim() || "—",
        clientName: (first.client_name ?? "").trim() || "Unnamed",
        contactPerson: (first.contact_person ?? "").trim() || "—",
        customerId: first.customer_id?.trim() || null,
        rows: rows.sort((a, b) =>
          a.productLabel.localeCompare(b.productLabel, undefined, {
            sensitivity: "base",
          }),
        ),
        totals: computeTotals(rows),
      };
    })
    .sort((a, b) => {
      const dateA = a.rows[0]?.created_at ?? "";
      const dateB = b.rows[0]?.created_at ?? "";
      return dateB.localeCompare(dateA);
    });
}

export type CustomerSnapshotBucket = {
  key: string;
  clientName: string;
  customerId: string | null;
  requestGroups: PipelineSnapshotGroup[];
  latestCreatedAt: string;
};

/** Cluster saved pipeline requests by customer (newest customers first). */
export function groupSnapshotsByCustomer(
  shipments: ImportShipmentRow[],
  products: ImportFinanceProduct[],
): CustomerSnapshotBucket[] {
  const requestGroups = groupPipelineSnapshots(shipments, products);
  const map = new Map<string, CustomerSnapshotBucket>();

  for (const group of requestGroups) {
    const key = `${group.clientName.toLowerCase().trim()}::${group.customerId ?? ""}`;
    const created = group.rows[0]?.created_at ?? "";
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        clientName: group.clientName,
        customerId: group.customerId,
        requestGroups: [group],
        latestCreatedAt: created,
      });
      continue;
    }
    map.set(key, {
      ...existing,
      requestGroups: [...existing.requestGroups, group].sort((a, b) => {
        const dateA = a.rows[0]?.created_at ?? "";
        const dateB = b.rows[0]?.created_at ?? "";
        return dateB.localeCompare(dateA);
      }),
      latestCreatedAt:
        created.localeCompare(existing.latestCreatedAt) > 0
          ? created
          : existing.latestCreatedAt,
    });
  }

  return [...map.values()].sort((a, b) =>
    b.latestCreatedAt.localeCompare(a.latestCreatedAt),
  );
}
