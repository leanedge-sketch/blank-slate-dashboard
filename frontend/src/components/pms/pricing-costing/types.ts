export interface PricingRecord {
  id: string;
  crmPartnerId: string;
  pmsProductId: string;
  incoterm: string;
  location: string;
  costCurrency: string;
  costAmount: number;
  priceCurrency: string;
  priceAmount: number;
  exchangeRateUsed: number | null;
  baseCurrency: string | null;
  validFrom: string;
  validTo: string | null;
  status: "active" | "historical" | "draft";
}

export interface CRMPartner {
  id: string;
  name: string;
  type: "buyer" | "supplier" | "logistics";
}

export interface PMSProduct {
  id: string;
  sku: string;
  name: string;
}

export type PricingRecordInput = Omit<
  PricingRecord,
  "id" | "validFrom" | "validTo" | "status"
>;
