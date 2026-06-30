/** Domain for rows in import_finance_shipments (distinct from sales_pipeline CRM deals). */
export type ImportFinancePipelineDomain = "procurement" | "sales";

export const PROCUREMENT_PIPELINE_DOMAIN: ImportFinancePipelineDomain = "procurement";
export const SALES_PIPELINE_DOMAIN: ImportFinancePipelineDomain = "sales";

export function parsePipelineDomain(
  value: string | null | undefined,
): ImportFinancePipelineDomain {
  return value === SALES_PIPELINE_DOMAIN
    ? SALES_PIPELINE_DOMAIN
    : PROCUREMENT_PIPELINE_DOMAIN;
}

export function pipelineDomainLabel(domain: ImportFinancePipelineDomain): string {
  return domain === SALES_PIPELINE_DOMAIN ? "Sales costing" : "Procurement";
}

/** Infer domain from DB column or legacy request-ref prefix (SALES- vs PROC-/TT-). */
export function inferShipmentDomain(row: {
  pipeline_domain?: string | null;
  sales_pipeline_id?: string | null;
  request_ref?: string | null;
}): ImportFinancePipelineDomain {
  if (row.sales_pipeline_id?.trim()) {
    return SALES_PIPELINE_DOMAIN;
  }
  if (row.pipeline_domain?.trim()) {
    return parsePipelineDomain(row.pipeline_domain);
  }
  const ref = (row.request_ref ?? "").trim().toUpperCase();
  if (ref.startsWith("SALES-")) {
    return SALES_PIPELINE_DOMAIN;
  }
  return PROCUREMENT_PIPELINE_DOMAIN;
}

export function filterShipmentsByDomain<T extends {
  pipeline_domain?: string | null;
  sales_pipeline_id?: string | null;
  request_ref?: string | null;
}>(
  rows: T[],
  domain: ImportFinancePipelineDomain,
): T[] {
  return rows.filter((row) => inferShipmentDomain(row) === domain);
}
