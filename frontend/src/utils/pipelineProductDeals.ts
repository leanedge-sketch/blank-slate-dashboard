import type { BusinessUnit, Currency, Forex, Incoterm } from "../services/api";

export interface ProductDealSpec {
  vendor_name: string | null;
  leadSourceEntries: string[];
  contactPerLeadEntries: string[];
  expected_close_date: string | null;
  business_model: string | null;
  business_unit: BusinessUnit | null;
  unit: string | null;
  amount: number | null;
  unit_price: number | null;
  currency: Currency | null;
  forex: Forex | null;
  incoterm: Incoterm | null;
}

export function emptyProductDealSpec(): ProductDealSpec {
  return {
    vendor_name: null,
    leadSourceEntries: [""],
    contactPerLeadEntries: [""],
    expected_close_date: null,
    business_model: null,
    business_unit: null,
    unit: null,
    amount: null,
    unit_price: null,
    currency: null,
    forex: null,
    incoterm: null,
  };
}

export function updateProductSpec(
  specs: Record<string, ProductDealSpec>,
  productId: string,
  patch: Partial<ProductDealSpec>,
): Record<string, ProductDealSpec> {
  return {
    ...specs,
    [productId]: {
      ...(specs[productId] ?? emptyProductDealSpec()),
      ...patch,
    },
  };
}
