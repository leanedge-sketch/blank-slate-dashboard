export interface PricingLocation {
  id: string;
  country: string;
  city?: string | null;
  port?: string | null;
}

export interface PricingRecord {
  id: string;
  crmPartnerId: string;
  pmsProductId: string;
  incoterm: string;
  locationId: string;
  costCurrency: string;
  costAmount: number;
  priceCurrency: string;
  priceAmount: number;
  needsCurrencyConversion: boolean;
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

export type PricingLocationInput = Omit<PricingLocation, "id">;
