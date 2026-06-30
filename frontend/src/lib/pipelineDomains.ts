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
