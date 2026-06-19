import { getSupabase } from "../lib/supabase";
import {
  DEFAULT_FINANCE_CONSTANTS,
  LOCAL_CLEARANCE_PER_KG_ETB,
  type FinanceConstants,
  type ImportFinanceInputs,
} from "../utils/importFinanceCalc";

export interface ImportFinanceProduct {
  id: string;
  product_name: string;
  base_customs_reference_usd: number;
  created_at?: string;
}

export interface ImportFinanceConstantsRow extends FinanceConstants {
  id: string;
}

export interface ImportShipmentRow {
  id: string;
  product_id: string;
  quantity_kg: number;
  supplier_base_price_usd: number;
  supplier_margin_pct: number;
  transport_to_border_usd: number;
  snapshot_official_rate: number;
  snapshot_parallel_rate: number;
  local_clearance_per_kg_etb: number;
  status: string;
  created_at: string;
}

function importFinanceDb() {
  return getSupabase();
}

const TABLES = {
  constants: "finance_constants",
  products: "import_finance_products",
  shipments: "import_finance_shipments",
} as const;

function mapConstantsRow(
  row: Record<string, unknown>,
): FinanceConstants {
  return {
    customsDutyPct: Number(row.customs_duty_pct ?? DEFAULT_FINANCE_CONSTANTS.customsDutyPct),
    scanFeePct: Number(row.scan_fee_pct ?? DEFAULT_FINANCE_CONSTANTS.scanFeePct),
    socialFeePct: Number(row.social_fee_pct ?? DEFAULT_FINANCE_CONSTANTS.socialFeePct),
    whtPct: Number(row.wht_pct ?? DEFAULT_FINANCE_CONSTANTS.whtPct),
    vatPct: Number(row.vat_pct ?? DEFAULT_FINANCE_CONSTANTS.vatPct),
    freightInsuranceBufferPct: Number(
      row.freight_insurance_buffer_pct ??
        DEFAULT_FINANCE_CONSTANTS.freightInsuranceBufferPct,
    ),
  };
}

export function importFinanceSetupHint(error: unknown): string | null {
  const msg = String(
    (error as { message?: string; details?: string })?.message ??
      (error as { details?: string })?.details ??
      error,
  ).toLowerCase();
  if (
    msg.includes("import_finance") ||
    msg.includes("schema") ||
    msg.includes("pgrst") ||
    msg.includes("permission denied")
  ) {
    return (
      "Run docs/0013b_import_finance_public_tables.sql in the Supabase SQL Editor " +
      "(creates public.finance_constants, import_finance_products, import_finance_shipments)."
    );
  }
  return null;
}

export async function fetchImportFinanceConstants(): Promise<FinanceConstants> {
  const { data, error } = await importFinanceDb()
    .from(TABLES.constants)
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_FINANCE_CONSTANTS;
  return mapConstantsRow(data as Record<string, unknown>);
}

export async function fetchImportFinanceProducts(): Promise<ImportFinanceProduct[]> {
  const { data, error } = await importFinanceDb()
    .from(TABLES.products)
    .select("id, product_name, base_customs_reference_usd, created_at")
    .order("product_name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    product_name: String(row.product_name),
    base_customs_reference_usd: Number(row.base_customs_reference_usd),
    created_at: row.created_at as string | undefined,
  }));
}

export async function createImportFinanceProduct(
  productName: string,
  baseCustomsReferenceUsd: number,
): Promise<ImportFinanceProduct> {
  const { data, error } = await importFinanceDb()
    .from(TABLES.products)
    .insert({
      product_name: productName.trim(),
      base_customs_reference_usd: baseCustomsReferenceUsd,
    })
    .select("id, product_name, base_customs_reference_usd, created_at")
    .single();

  if (error) throw error;
  return {
    id: String(data.id),
    product_name: String(data.product_name),
    base_customs_reference_usd: Number(data.base_customs_reference_usd),
    created_at: data.created_at as string | undefined,
  };
}

export async function saveImportShipmentDraft(
  productId: string,
  inputs: ImportFinanceInputs,
): Promise<ImportShipmentRow> {
  const { data, error } = await importFinanceDb()
    .from(TABLES.shipments)
    .insert({
      product_id: productId,
      quantity_kg: inputs.quantityKg,
      supplier_base_price_usd: inputs.supplierBasePriceUsd,
      supplier_margin_pct: inputs.supplierMarginPct,
      transport_to_border_usd: inputs.transportToBorderUsdPerKg,
      snapshot_official_rate: inputs.officialRate,
      snapshot_parallel_rate: inputs.parallelRate,
      local_clearance_per_kg_etb: LOCAL_CLEARANCE_PER_KG_ETB,
      status: "draft",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ImportShipmentRow;
}

export async function fetchRecentImportShipments(
  limit = 20,
): Promise<ImportShipmentRow[]> {
  const { data, error } = await importFinanceDb()
    .from(TABLES.shipments)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ImportShipmentRow[];
}
