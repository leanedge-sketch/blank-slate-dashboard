export interface PricingRecord {
  id: string;
  incoterm: string;
  location: string;
  costCurrency: string;
  costAmount: number | null;
  priceCurrency: string;
  priceAmount: number | null;
}

export interface Partner {
  id: string;
  name: string;
  activeTOS: string;
  pricingRecords: PricingRecord[];
}

export type PricingRecordInput = Omit<PricingRecord, "id">;
