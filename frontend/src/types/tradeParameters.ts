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
  };
}
