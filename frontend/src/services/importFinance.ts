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
import {
  type ImportFinancePipelineDomain,
  PROCUREMENT_PIPELINE_DOMAIN,
  filterShipmentsByDomain,
  parsePipelineDomain,
} from "../lib/pipelineDomains";

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
  /** Customer quote currency at save (USD / ETB). */
  snapshot_target_currency?: string | null;
  /** procurement | sales — separates Trade & Transit from sales-deal costing. */
  pipeline_domain?: ImportFinancePipelineDomain | string | null;
  /** Set when pipeline_domain is sales and costing is tied to a CRM deal. */
  sales_pipeline_id?: string | null;
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
  const fallback = DEFAULT_FINANCE_CONSTANTS;
  const read = (key: string, defaultValue: number) => {
    const raw = row[key];
    if (raw === undefined || raw === null || raw === "") return defaultValue;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };

  return {
    customsDutyPct: read("customs_duty_pct", fallback.customsDutyPct),
    scanFeePct: normalizeScanFeePct(
      read("scan_fee_pct", fallback.scanFeePct),
    ),
    socialFeePct: read("social_fee_pct", fallback.socialFeePct),
    whtPct: read("wht_pct", fallback.whtPct),
    vatPct: read("vat_pct", fallback.vatPct),
    freightInsuranceBufferPct: read(
      "freight_insurance_buffer_pct",
      fallback.freightInsuranceBufferPct,
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
    targetCurrency?: string | null;
    pipelineDomain?: ImportFinancePipelineDomain;
    salesPipelineId?: string | null;
  },
) {
  const targetCurrency = (clientContext?.targetCurrency ?? "ETB")
    .toString()
    .trim()
    .toUpperCase();

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
    snapshot_target_currency: targetCurrency === "USD" ? "USD" : "ETB",
    pipeline_domain: parsePipelineDomain(
      clientContext?.pipelineDomain ?? PROCUREMENT_PIPELINE_DOMAIN,
    ),
    sales_pipeline_id: clientContext?.salesPipelineId?.trim() || null,
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
      "docs/0014_import_finance_pipeline_columns.sql and " +
      "docs/0025_import_finance_pipeline_domain.sql in the Supabase SQL Editor."
    );
  }
  return null;
}

function isMissingPipelineDomainColumn(error: unknown): boolean {
  const msg = String(
    (error as { message?: string; details?: string })?.message ??
      (error as { details?: string })?.details ??
      error,
  ).toLowerCase();
  return (
    msg.includes("pipeline_domain") ||
    msg.includes("sales_pipeline_id") ||
    (msg.includes("column") && msg.includes("import_finance"))
  );
}

function stripDomainFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const { pipeline_domain, sales_pipeline_id, ...rest } = payload;
  return rest;
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
    base_customs_reference_usd: Number.isFinite(Number(row.base_customs_reference_usd))
      ? Number(row.base_customs_reference_usd)
      : 0,
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
    targetCurrency?: string | null;
    pipelineDomain?: ImportFinancePipelineDomain;
    salesPipelineId?: string | null;
  },
  resultOverride?: ImportFinanceResult,
): Promise<ImportShipmentRow> {
  const payload = buildShipmentPipelinePayload(
    productId,
    inputs,
    constants,
    resultOverride ?? calculateImportFinance(inputs, constants),
    clientContext,
  );

  let { data, error } = await importFinanceDb()
    .from(TABLES.shipments)
    .insert(payload)
    .select("*")
    .single();

  if (error && isMissingPipelineDomainColumn(error)) {
    const retry = await importFinanceDb()
      .from(TABLES.shipments)
      .insert(stripDomainFields(payload as Record<string, unknown>))
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return data as ImportShipmentRow;
}

export async function fetchRecentImportShipments(
  limit = 20,
  options?: { pipelineDomain?: ImportFinancePipelineDomain },
): Promise<ImportShipmentRow[]> {
  const domain = options?.pipelineDomain;

  if (domain) {
    const filtered = await importFinanceDb()
      .from(TABLES.shipments)
      .select("*")
      .eq("pipeline_domain", domain)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!filtered.error) {
      return filterShipmentsByDomain(
        (filtered.data ?? []) as ImportShipmentRow[],
        domain,
      );
    }

    if (!isMissingPipelineDomainColumn(filtered.error)) {
      throw filtered.error;
    }
  }

  const { data, error } = await importFinanceDb()
    .from(TABLES.shipments)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(domain ? Math.max(limit, 200) : limit);

  if (error) throw error;
  const rows = (data ?? []) as ImportShipmentRow[];
  return domain ? filterShipmentsByDomain(rows, domain).slice(0, limit) : rows;
}

/** Search saved import pipelines by client company and/or contact person. */
export async function searchImportShipmentsByClientContact(
  clientName?: string,
  contactPerson?: string,
  limit = 80,
): Promise<ImportShipmentRow[]> {
  const company = clientName?.trim() ?? "";
  const contact = contactPerson?.trim() ?? "";
  if (!company && !contact) return [];

  let query = importFinanceDb()
    .from(TABLES.shipments)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (company) {
    query = query.ilike("client_name", `%${company}%`);
  }
  if (contact) {
    query = query.ilike("contact_person", `%${contact}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ImportShipmentRow[];
}

/** Shipments for executive report dashboards (date-filtered, higher limit). */
export async function fetchImportShipmentsForReport(
  options?: {
    startIso?: string;
    endIso?: string;
    limit?: number;
    pipelineDomain?: ImportFinancePipelineDomain;
  },
): Promise<ImportShipmentRow[]> {
  const domain = options?.pipelineDomain;
  const rowLimit = options?.limit ?? 500;

  if (domain) {
    let query = importFinanceDb()
      .from(TABLES.shipments)
      .select("*")
      .eq("pipeline_domain", domain)
      .order("created_at", { ascending: true });

    if (options?.startIso) {
      query = query.gte("created_at", options.startIso);
    }
    if (options?.endIso) {
      query = query.lte("created_at", options.endIso);
    }
    query = query.limit(rowLimit);

    const filtered = await query;
    if (!filtered.error) {
      return filterShipmentsByDomain(
        (filtered.data ?? []) as ImportShipmentRow[],
        domain,
      );
    }
    if (!isMissingPipelineDomainColumn(filtered.error)) {
      throw filtered.error;
    }
  }

  let query = importFinanceDb()
    .from(TABLES.shipments)
    .select("*")
    .order("created_at", { ascending: true });

  if (options?.startIso) {
    query = query.gte("created_at", options.startIso);
  }
  if (options?.endIso) {
    query = query.lte("created_at", options.endIso);
  }
  query = query.limit(domain ? Math.max(rowLimit, 500) : rowLimit);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as ImportShipmentRow[];
  return domain
    ? filterShipmentsByDomain(rows, domain).slice(0, rowLimit)
    : rows;
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

/** Permanently delete saved pipeline shipment rows (whole request / all product lines). */
export async function deleteImportPipelineShipments(
  rows: ImportShipmentRow[],
): Promise<number> {
  const ids = [...new Set(rows.map((row) => row.id).filter(Boolean))];
  if (ids.length === 0) return 0;

  const { error } = await importFinanceDb()
    .from(TABLES.shipments)
    .delete()
    .in("id", ids);

  if (error) throw error;
  return ids.length;
}
