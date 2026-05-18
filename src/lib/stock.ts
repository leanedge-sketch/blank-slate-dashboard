// src/lib/stock.ts
// Shared types + Supabase fetchers for the Logistics & Stock views.

import { supabase } from "./supabase";
import {
  STOCK_LOCATIONS,
  TRANSACTION_SIGN,
  type StockLocation,
  type TransactionType,
  type Unit,
} from "./enums";

export interface StockMovementRow {
  id: string;
  date: string; // ISO yyyy-mm-dd
  product_id: string;
  location: StockLocation;
  transfer_to_location: StockLocation | null;
  transaction_type: TransactionType;
  unit: Unit;
  // Quantity columns — different transaction types populate different fields.
  sales_kg: number | null;
  purchase_kg: number | null;
  inter_company_transfer_kg: number | null;
  sample_kg: number | null;
  damage_kg: number | null;
  stock_availability_kg: number | null;
  balance_kg: number | null;
  reference: string | null;
  remark: string | null;
  created_at: string | null;
  // Joined
  product?: { id: string; chemical: string | null; brand: string | null; packaging: string | null } | null;
}

export interface MovementsQuery {
  limit?: number;
  offset?: number;
  location?: StockLocation | "all";
  transactionType?: TransactionType | "all";
  search?: string; // matches reference / remark
  sortBy?: "date" | "created_at";
  sortDir?: "asc" | "desc";
}

export async function fetchStockMovements(
  q: MovementsQuery = {},
): Promise<{ rows: StockMovementRow[]; count: number }> {
  const {
    limit = 50,
    offset = 0,
    location = "all",
    transactionType = "all",
    search = "",
    sortBy = "date",
    sortDir = "desc",
  } = q;

  let query = supabase
    .from("stock_movements")
    .select(
      `id, date, product_id, location, transfer_to_location, transaction_type, unit,
       sales_kg, purchase_kg, inter_company_transfer_kg, sample_kg, damage_kg,
       stock_availability_kg, balance_kg, reference, remark, created_at,
       product:products!stock_movements_product_id_fkey ( id, chemical, brand, packaging )`,
      { count: "exact" },
    )
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(offset, offset + limit - 1);

  if (location !== "all") query = query.eq("location", location);
  if (transactionType !== "all") query = query.eq("transaction_type", transactionType);
  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`reference.ilike.${term},remark.ilike.${term}`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as StockMovementRow[], count: count ?? 0 };
}

// -----------------------------------------------------------------------------
// Availability aggregation
// -----------------------------------------------------------------------------

export interface LocationBalance {
  location: StockLocation;
  netKg: number;
  inflowKg: number;
  outflowKg: number;
  movementCount: number;
}

function movementKg(row: StockMovementRow): number {
  // Sum whatever quantity column is populated for this transaction type.
  return (
    (row.sales_kg ?? 0) +
    (row.purchase_kg ?? 0) +
    (row.sample_kg ?? 0) +
    (row.damage_kg ?? 0) +
    (row.stock_availability_kg ?? 0) +
    (row.inter_company_transfer_kg ?? 0)
  );
}

/**
 * Aggregate net stock per location from raw ledger rows.
 *
 * Inter-company transfer rules:
 *   - A leg with `transfer_to_location IS NOT NULL` is the SOURCE leg:
 *     it removes stock from `location`.
 *   - A leg with `transfer_to_location IS NULL` is the DESTINATION leg:
 *     it adds stock to `location`.
 *
 * "Stock Availability" rows are treated as opening balances (added to inflow).
 */
export function aggregateByLocation(rows: StockMovementRow[]): LocationBalance[] {
  const acc: Record<StockLocation, LocationBalance> = Object.fromEntries(
    STOCK_LOCATIONS.map((loc) => [
      loc,
      { location: loc, netKg: 0, inflowKg: 0, outflowKg: 0, movementCount: 0 },
    ]),
  ) as Record<StockLocation, LocationBalance>;

  for (const row of rows) {
    const bucket = acc[row.location];
    if (!bucket) continue;

    const qty = movementKg(row);
    let delta = 0;

    if (row.transaction_type === "Inter-company transfer") {
      delta = row.transfer_to_location ? -qty : qty;
    } else if (row.transaction_type === "Stock Availability") {
      delta = qty; // opening balance / snapshot
    } else {
      delta = TRANSACTION_SIGN[row.transaction_type] * qty;
    }

    bucket.netKg += delta;
    if (delta >= 0) bucket.inflowKg += delta;
    else bucket.outflowKg += Math.abs(delta);
    bucket.movementCount += 1;
  }

  return Object.values(acc);
}

// -----------------------------------------------------------------------------
// Pre-aggregated balances from the `stock_balance_by_location` SQL view
// (see docs/0003_stock_balance_view.sql). Pushes the signed-quantity math
// into Postgres so the client no longer pulls raw ledger rows.
// -----------------------------------------------------------------------------

export interface StockBalanceRow {
  location: StockLocation;
  net_kg: number;
  inflow_kg: number;
  outflow_kg: number;
  movement_count: number;
}

/**
 * Fetch pre-computed per-location stock balances from the database view.
 * Replaces the legacy `fetchAllMovementsForAggregation` + client-side
 * `aggregateByLocation` pipeline (and its 5,000-row defensive cap).
 */
export async function fetchStockBalances(): Promise<LocationBalance[]> {
  const { data, error } = await supabase
    .from("stock_balance_by_location")
    .select("location, net_kg, inflow_kg, outflow_kg, movement_count");

  if (error) throw new Error(error.message);

  const byLocation: Record<StockLocation, LocationBalance> = Object.fromEntries(
    STOCK_LOCATIONS.map((loc) => [
      loc,
      { location: loc, netKg: 0, inflowKg: 0, outflowKg: 0, movementCount: 0 },
    ]),
  ) as Record<StockLocation, LocationBalance>;

  for (const row of (data ?? []) as StockBalanceRow[]) {
    const bucket = byLocation[row.location];
    if (!bucket) continue;
    bucket.netKg = Number(row.net_kg) || 0;
    bucket.inflowKg = Number(row.inflow_kg) || 0;
    bucket.outflowKg = Number(row.outflow_kg) || 0;
    bucket.movementCount = Number(row.movement_count) || 0;
  }

  return Object.values(byLocation);
}
