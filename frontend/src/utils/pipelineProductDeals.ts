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

/** True when the user has not filled commercial/quantity fields yet. */
export function isBlankProductDealSpec(spec: ProductDealSpec | null | undefined): boolean {
  if (!spec) return true;
  return (
    spec.amount == null &&
    !spec.unit &&
    spec.unit_price == null &&
    !spec.business_model &&
    !spec.business_unit &&
    !spec.currency &&
    !spec.forex &&
    !spec.incoterm &&
    !spec.expected_close_date &&
    !spec.vendor_name
  );
}

/** Fill only empty fields from a source spec (keeps user edits). */
export function mergeProductDealSpec(
  current: ProductDealSpec | null | undefined,
  source: ProductDealSpec,
): ProductDealSpec {
  const base = current ?? emptyProductDealSpec();
  return {
    vendor_name: base.vendor_name || source.vendor_name,
    leadSourceEntries:
      base.leadSourceEntries.some((s) => s.trim())
        ? base.leadSourceEntries
        : source.leadSourceEntries,
    contactPerLeadEntries:
      base.contactPerLeadEntries.some((s) => s.trim())
        ? base.contactPerLeadEntries
        : source.contactPerLeadEntries,
    expected_close_date: base.expected_close_date || source.expected_close_date,
    business_model: base.business_model || source.business_model,
    business_unit: base.business_unit || source.business_unit,
    unit: base.unit || source.unit,
    amount: base.amount ?? source.amount,
    unit_price: base.unit_price ?? source.unit_price,
    currency: base.currency || source.currency,
    forex: base.forex || source.forex,
    incoterm: base.incoterm || source.incoterm,
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
