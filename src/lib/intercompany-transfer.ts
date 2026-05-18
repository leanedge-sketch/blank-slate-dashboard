// src/lib/intercompany-transfer.ts
// Framework-agnostic validation + RPC wrapper for inter-company transfers.
// Mirrors `backend/app/utils/validators.py::validate_intercompany_transfer_pair`
// so the form catches obvious errors BEFORE the network call hits the
// `insert_intercompany_transfer` RPC and its deferred SQL trigger.

import { z } from "zod";
import { supabase } from "./supabase";

// Mirrors backend/app/models/enums.py::StockLocation
export const STOCK_LOCATIONS = [
  "Adwa",
  "Wholesaler",
  "Bahir Dar",
  "Mekele",
  "Hawassa",
] as const;
export type StockLocation = (typeof STOCK_LOCATIONS)[number];

// Mirrors enums.Unit
export const UNITS = ["kg", "g", "L", "mL", "pcs"] as const;
export type Unit = (typeof UNITS)[number];

// -----------------------------------------------------------------------------
// Zod schema — single source of truth for the form
// -----------------------------------------------------------------------------
export const transferSchema = z
  .object({
    productId: z.string().uuid({ message: "Select a product." }),
    date: z
      .string()
      .min(1, { message: "Transfer date is required." })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date." }),
    sourceLocation: z.enum(STOCK_LOCATIONS, {
      errorMap: () => ({ message: "Choose a source location." }),
    }),
    destinationLocation: z.enum(STOCK_LOCATIONS, {
      errorMap: () => ({ message: "Choose a destination location." }),
    }),
    quantityKg: z
      .number({ invalid_type_error: "Quantity must be a number." })
      .positive({ message: "Quantity must be greater than zero." })
      .max(1_000_000, { message: "Quantity looks unrealistic." }),
    unit: z.enum(UNITS),
    reference: z.string().trim().max(120).optional().or(z.literal("")),
    remark: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((v) => v.sourceLocation !== v.destinationLocation, {
    path: ["destinationLocation"],
    message: "Source and destination must differ.",
  });

export type TransferInput = z.infer<typeof transferSchema>;

// -----------------------------------------------------------------------------
// RPC call
// -----------------------------------------------------------------------------
export interface TransferResult {
  source_id: string;
  destination_id: string;
}

export async function submitIntercompanyTransfer(
  input: TransferInput,
): Promise<TransferResult> {
  const { data, error } = await supabase.rpc("insert_intercompany_transfer", {
    p_product_id: input.productId,
    p_date: input.date,
    p_source_location: input.sourceLocation,
    p_destination_location: input.destinationLocation,
    p_quantity_kg: input.quantityKg,
    p_unit: input.unit,
    p_reference: input.reference || null,
    p_remark: input.remark || null,
  });

  if (error) {
    // PostgREST surfaces RAISE EXCEPTION text in `message`; trigger context
    // (HINT / DETAIL) lands in `details` / `hint`.
    const detail = [error.hint, error.details].filter(Boolean).join(" · ");
    throw new Error(detail ? `${error.message} — ${detail}` : error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.source_id || !row?.destination_id) {
    throw new Error("RPC returned no transfer IDs.");
  }
  return row as TransferResult;
}

// -----------------------------------------------------------------------------
// Product lookup for the picker
// -----------------------------------------------------------------------------
export interface ProductOption {
  id: string;
  label: string;
}

export async function fetchProducts(): Promise<ProductOption[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,chemical,brand,packaging")
    .order("chemical")
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    label: `${r.chemical ?? "?"} — ${r.brand ?? "?"} (${r.packaging ?? "?"})`,
  }));
}
