/** Incoterms — defines cost/liability baseline for import quotes. */
export const TRADE_INCOTERMS = ["FOB", "CIF", "EXW", "DAP", "CFR", "FCA"] as const;
export type TradeIncoterm = (typeof TRADE_INCOTERMS)[number];

export const TRADE_PAYMENT_TERMS = [
  "LC at Sight",
  "LC 30 Days",
  "TT 30 Days",
  "TT 60 Days",
  "100% Advance",
  "50% Advance / 50% on BL",
  "Open Account",
] as const;
export type TradePaymentTerm = (typeof TRADE_PAYMENT_TERMS)[number];

export const TRADE_CURRENCIES = ["USD", "EUR", "CNY", "ETB"] as const;
export type TradeCurrency = (typeof TRADE_CURRENCIES)[number];

/**
 * Master trade / quote parameters captured before product costing.
 * Shared across Trade Parameters, Product Costing, and Transit Summary workspaces.
 */
export interface TradeParameters {
  /** CRM customers.customer_id when buyer is picked from CRM. */
  customerId: string;
  clientName: string;
  /** Buyer contact for this request — from CRM primary contact or entered manually. */
  contactPerson: string;
  /** ISO date (YYYY-MM-DD) — when this customer request was raised. */
  requestDate: string;
  requestRef: string;
  incoterm: TradeIncoterm;
  paymentTerms: TradePaymentTerm | string;
  baseCurrency: TradeCurrency | string;
  targetCurrency: TradeCurrency | string;
  /** Locked parallel / capital forex rate (ETB per 1 base currency unit). */
  exchangeRate: number;
  portOfLoading: string;
  portOfDischarge: string;
  /** ISO date (YYYY-MM-DD) — quote validity / expiry. */
  validityDate: string;
}

export const DEFAULT_TRADE_PARAMETERS: TradeParameters = {
  customerId: "",
  clientName: "",
  contactPerson: "",
  requestDate: "",
  requestRef: "",
  incoterm: "FOB",
  paymentTerms: "LC at Sight",
  baseCurrency: "USD",
  targetCurrency: "ETB",
  exchangeRate: 190,
  portOfLoading: "",
  portOfDischarge: "Djibouti / Addis Ababa corridor",
  validityDate: "",
};

export function createDefaultValidityDate(daysAhead = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Unique request number when not supplied by workbook or user. */
export function generatePipelineRequestRef(
  requestDate?: string,
  prefix: "PROC" | "SALES" | "TT" = "PROC",
): string {
  const d = (requestDate?.trim() || todayIsoDate()).replace(/-/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${d}-${suffix}`;
}

export function ensurePipelineRequestIds(
  fields: {
    requestDate?: string;
    requestRef?: string;
  },
  refPrefix: "PROC" | "SALES" | "TT" = "PROC",
): { requestDate: string; requestRef: string } {
  const requestDate = fields.requestDate?.trim() || todayIsoDate();
  const requestRef =
    fields.requestRef?.trim() || generatePipelineRequestRef(requestDate, refPrefix);
  return { requestDate, requestRef };
}

export function validatePipelineRequestFields(fields: {
  clientName: string;
  contactPerson: string;
  requestDate: string;
  requestRef: string;
}): string | null {
  if (!fields.clientName.trim()) {
    return "Customer name is required for this pipeline entry.";
  }
  if (!fields.contactPerson.trim()) {
    return "Contact person is required for this pipeline entry.";
  }
  if (!fields.requestDate.trim()) {
    return "Request date is required for this pipeline entry.";
  }
  if (!fields.requestRef.trim()) {
    return "Pipeline / request number is required for this pipeline entry.";
  }
  return null;
}

export function normalizeTradeParameters(
  partial?: Partial<TradeParameters>,
): TradeParameters {
  return {
    ...DEFAULT_TRADE_PARAMETERS,
    ...partial,
    validityDate:
      partial?.validityDate?.trim() ||
      DEFAULT_TRADE_PARAMETERS.validityDate ||
      createDefaultValidityDate(),
    requestDate:
      partial?.requestDate?.trim() ||
      DEFAULT_TRADE_PARAMETERS.requestDate ||
      todayIsoDate(),
  };
}
