// src/lib/enums.ts
// TypeScript mirror of backend/app/models/enums.py — keep these in lockstep.
// The Postgres CHECK constraints (docs/0001_enums_and_integrity.sql) validate
// the same literals at the database layer.

export const STOCK_LOCATIONS = [
  "addis_ababa",
  "sez_kenya",
  "nairobi_partner",
] as const;
export type StockLocation = (typeof STOCK_LOCATIONS)[number];

export const STOCK_LOCATION_LABELS: Record<StockLocation, string> = {
  addis_ababa: "Addis Ababa",
  sez_kenya: "SEZ Kenya",
  nairobi_partner: "Nairobi (Partner)",
};

export const TRANSACTION_TYPES = [
  "Sales",
  "Purchase",
  "Inter-company transfer",
  "Sample",
  "Damage",
  "Stock Availability",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const UNITS = ["kg", "ton", "g", "lb", "oz", "piece", "unit"] as const;
export type Unit = (typeof UNITS)[number];

// Sign convention for aggregating stock balances from the ledger.
// Positive = inflow into `location`. Inter-company transfer is special:
// the source leg is negative, destination leg is positive — but in this
// schema each leg writes its own row with `inter_company_transfer_kg` and
// the destination leg has `transfer_to_location IS NULL`. We treat the
// row's `location` field as the active warehouse for the leg.
export const TRANSACTION_SIGN: Record<TransactionType, 1 | -1 | 0> = {
  Sales: -1,
  Purchase: 1,
  "Inter-company transfer": 0, // handled per-leg in the aggregator
  Sample: -1,
  Damage: -1,
  "Stock Availability": 0, // opening-balance markers — not a movement
};
