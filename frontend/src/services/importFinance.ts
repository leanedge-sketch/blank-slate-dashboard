import { getSupabase } from "../lib/supabase";
import {
  calculateImportFinance,
  DEFAULT_FINANCE_CONSTANTS,
  LOCAL_CLEARANCE_PER_KG_ETB,
  normalizeScanFeePct,
  type FinanceConstants,
  type ImportFinanceInputs,
  type ImportFinanceResult,
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
  snapshot_base_customs_reference_usd?: number | null;
  target_selling_price_etb_per_kg?: number | null;
  material_cost_usd_per_kg?: number | null;
  border_value_usd_per_kg?: number | null;
  capital_outlay_etb?: number | null;
  cif_assessed_usd_per_kg?: number | null;
  cif_base_etb?: number | null;
  duty_etb?: number | null;
  scan_fee_etb?: number | null;
  social_fee_etb?: number | null;
  wht_etb?: number | null;
  vat_etb?: number | null;
  total_customs_paid_etb?: number | null;
  inland_transport_etb?: number | null;
  gross_investment_etb?: number | null;
  net_landed_cost_etb?: number | null;
  final_landed_unit_cost_etb_per_kg?: number | null;
  profit_per_kg_etb?: number | null;
  gross_margin_pct?: number | null;
  total_expected_revenue_etb?: number | null;
  client_name?: string | null;
  contact_person?: string | null;
  request_date?: string | null;
  request_ref?: string | null;
  chemical_type_id?: string | null;
  customer_id?: string | null;
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
    scanFeePct: normalizeScanFeePct(
      Number(row.scan_fee_pct ?? DEFAULT_FINANCE_CONSTANTS.scanFeePct),
    ),
    socialFeePct: Number(row.social_fee_pct ?? DEFAULT_FINANCE_CONSTANTS.socialFeePct),
    whtPct: Number(row.wht_pct ?? DEFAULT_FINANCE_CONSTANTS.whtPct),
    vatPct: Number(row.vat_pct ?? DEFAULT_FINANCE_CONSTANTS.vatPct),
    freightInsuranceBufferPct: Number(
      row.freight_insurance_buffer_pct ??
        DEFAULT_FINANCE_CONSTANTS.freightInsuranceBufferPct,
    ),
  };
}

export function buildShipmentPipelinePayload(
  productId: string,
  inputs: ImportFinanceInputs,
  constants: FinanceConstants = DEFAULT_FINANCE_CONSTANTS,
  result: ImportFinanceResult = calculateImportFinance(inputs, constants),
  clientContext?: {
    clientName?: string;
    contactPerson?: string;
    requestDate?: string;
    requestRef?: string;
    chemicalTypeId?: string | null;
    customerId?: string | null;
  },
) {
  return {
    product_id: productId,
    quantity_kg: inputs.quantityKg,
    supplier_base_price_usd: inputs.supplierBasePriceUsd,
    supplier_margin_pct: inputs.supplierMarginPct,
    transport_to_border_usd: inputs.transportToBorderUsdPerKg,
    snapshot_official_rate: inputs.officialRate,
    snapshot_parallel_rate: inputs.parallelRate,
    local_clearance_per_kg_etb: LOCAL_CLEARANCE_PER_KG_ETB,
    snapshot_base_customs_reference_usd: inputs.baseCustomsReferenceUsd,
    target_selling_price_etb_per_kg: inputs.targetSellingPriceEtbPerKg,
    material_cost_usd_per_kg: result.capital.materialCostUsdPerKg,
    border_value_usd_per_kg: result.capital.borderValueUsdPerKg,
    capital_outlay_etb: result.capital.totalCapitalEtb,
    cif_assessed_usd_per_kg: result.customs.cifAssessedUsdPerKg,
    cif_base_etb: result.customs.cifBaseEtb,
    duty_etb: result.customs.dutyEtb,
    scan_fee_etb: result.customs.scanFeeEtb,
    social_fee_etb: result.customs.socialFeeEtb,
    wht_etb: result.customs.whtEtb,
    vat_etb: result.customs.vatEtb,
    total_customs_paid_etb: result.customs.totalCustomsPaidEtb,
    inland_transport_etb: result.bottomLine.totalLocalClearanceEtb,
    gross_investment_etb: result.bottomLine.grossInvestmentEtb,
    net_landed_cost_etb: result.bottomLine.netLandedCostEtb,
    final_landed_unit_cost_etb_per_kg: result.bottomLine.finalUnitCostEtbPerKg,
    profit_per_kg_etb: result.sales.profitPerKgEtb,
    gross_margin_pct: result.sales.grossMarginPct,
    total_expected_revenue_etb: result.sales.totalExpectedRevenueEtb,
    client_name: clientContext?.clientName?.trim() || null,
    contact_person: clientContext?.contactPerson?.trim() || null,
    request_date: clientContext?.requestDate?.trim() || null,
    request_ref: clientContext?.requestRef?.trim() || null,
    chemical_type_id: clientContext?.chemicalTypeId?.trim() || null,
    customer_id: clientContext?.customerId?.trim() || null,
    status: "draft" as const,
  };
}

export function shipmentRowToInputs(row: ImportShipmentRow): ImportFinanceInputs {
  return {
    quantityKg: Number(row.quantity_kg),
    officialRate: Number(row.snapshot_official_rate),
    parallelRate: Number(row.snapshot_parallel_rate),
    supplierBasePriceUsd: Number(row.supplier_base_price_usd),
    supplierMarginPct: Number(row.supplier_margin_pct),
    transportToBorderUsdPerKg: Number(row.transport_to_border_usd),
    baseCustomsReferenceUsd: Number(
      row.snapshot_base_customs_reference_usd ?? 0,
    ),
    targetSellingPriceEtbPerKg: Number(
      row.target_selling_price_etb_per_kg ?? 0,
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
    msg.includes("permission denied") ||
    msg.includes("column") ||
    msg.includes("capital_outlay")
  ) {
    return (
      "Run docs/0013b_import_finance_public_tables.sql, then " +
      "docs/0014_import_finance_pipeline_columns.sql in the Supabase SQL Editor."
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

/** Match by name or create a finance product row for customs reference persistence. */
export async function resolveImportFinanceProductId(
  products: ImportFinanceProduct[],
  productName: string,
  baseCustomsReferenceUsd: number,
): Promise<ImportFinanceProduct> {
  const norm = productName.trim().toLowerCase();
  const existing = products.find(
    (p) => p.product_name.trim().toLowerCase() === norm,
  );
  if (existing) return existing;
  return createImportFinanceProduct(productName, baseCustomsReferenceUsd);
}

export async function saveImportShipmentDraft(
  productId: string,
  inputs: ImportFinanceInputs,
  constants: FinanceConstants = DEFAULT_FINANCE_CONSTANTS,
  clientContext?: {
    clientName?: string;
    contactPerson?: string;
    requestDate?: string;
    requestRef?: string;
    chemicalTypeId?: string | null;
    customerId?: string | null;
  },
): Promise<ImportShipmentRow> {
  const payload = buildShipmentPipelinePayload(
    productId,
    inputs,
    constants,
    calculateImportFinance(inputs, constants),
    clientContext,
  );

  const { data, error } = await importFinanceDb()
    .from(TABLES.shipments)
    .insert(payload)
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

export async function fetchImportShipmentsForCustomer(
  customerId: string,
  limit = 20,
): Promise<ImportShipmentRow[]> {
  const { data, error } = await importFinanceDb()
    .from(TABLES.shipments)
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ImportShipmentRow[];
}

export async function fetchImportShipmentsByClientName(
  clientName: string,
  limit = 20,
): Promise<ImportShipmentRow[]> {
  const trimmed = clientName.trim();
  if (!trimmed) return [];
  const { data, error } = await importFinanceDb()
    .from(TABLES.shipments)
    .select("*")
    .ilike("client_name", trimmed)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ImportShipmentRow[];
}
