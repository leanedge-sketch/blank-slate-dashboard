import { api } from "../../../services/api";
import type {
  CRMPartner,
  PMSProduct,
  PricingLocation,
  PricingLocationInput,
  PricingRecord,
  PricingRecordInput,
} from "./types";
import { todayISO } from "./utils";

type ApiPricingLocation = {
  id: string;
  country: string;
  city?: string | null;
  port?: string | null;
  created_at?: string | null;
};

type ApiPricingRecord = {
  id: string;
  crm_partner_id: string;
  pms_product_id: string;
  incoterm: string;
  location_id: string;
  cost_currency: string;
  cost_amount: number;
  price_currency: string;
  price_amount: number;
  needs_currency_conversion: boolean;
  exchange_rate_used?: number | null;
  base_currency?: string | null;
  valid_from: string;
  valid_to?: string | null;
  status: "active" | "historical" | "draft";
  created_at?: string | null;
  updated_at?: string | null;
};

function mapLocation(row: ApiPricingLocation): PricingLocation {
  return {
    id: row.id,
    country: row.country,
    city: row.city ?? null,
    port: row.port ?? null,
  };
}

function mapRecord(row: ApiPricingRecord): PricingRecord {
  return {
    id: row.id,
    crmPartnerId: row.crm_partner_id,
    pmsProductId: row.pms_product_id,
    incoterm: row.incoterm,
    locationId: row.location_id,
    costCurrency: row.cost_currency,
    costAmount: Number(row.cost_amount),
    priceCurrency: row.price_currency,
    priceAmount: Number(row.price_amount),
    needsCurrencyConversion: row.needs_currency_conversion,
    exchangeRateUsed: row.exchange_rate_used ?? null,
    baseCurrency: row.base_currency ?? null,
    validFrom: row.valid_from,
    validTo: row.valid_to ?? null,
    status: row.status,
  };
}

function toApiRecordInput(
  input: PricingRecordInput,
  status: PricingRecord["status"] = "active",
): Record<string, unknown> {
  return {
    crm_partner_id: input.crmPartnerId,
    pms_product_id: input.pmsProductId,
    incoterm: input.incoterm,
    location_id: input.locationId,
    cost_currency: input.costCurrency,
    cost_amount: input.costAmount,
    price_currency: input.priceCurrency,
    price_amount: input.priceAmount,
    needs_currency_conversion: input.needsCurrencyConversion,
    exchange_rate_used: input.exchangeRateUsed,
    base_currency: input.baseCurrency,
    valid_from: todayISO(),
    valid_to: null,
    status,
  };
}

export function mapCustomerToCRMPartner(customer: {
  customer_id: string;
  customer_name: string;
}): CRMPartner {
  return {
    id: customer.customer_id,
    name: customer.customer_name,
    type: "buyer",
  };
}

export function mapChemicalToPMSProduct(chemical: {
  id: number;
  uuid_id?: string | null;
  product_name?: string | null;
  hs_code?: string | null;
  generic_name?: string | null;
}): PMSProduct {
  return {
    id: chemical.uuid_id ?? String(chemical.id),
    sku: chemical.hs_code || chemical.generic_name || `SKU-${chemical.id}`,
    name: chemical.product_name || chemical.generic_name || `Product ${chemical.id}`,
  };
}

export async function loadPricingLocations(): Promise<PricingLocation[]> {
  const res = await api.get<{ locations: ApiPricingLocation[]; total: number }>(
    "/pms/pricing-junction/locations",
    { params: { limit: 500 } },
  );
  return (res.data.locations ?? []).map(mapLocation);
}

export async function createPricingLocationApi(
  input: PricingLocationInput,
): Promise<PricingLocation> {
  const res = await api.post<ApiPricingLocation>(
    "/pms/pricing-junction/locations",
    {
      country: input.country,
      city: input.city ?? null,
      port: input.port ?? null,
    },
  );
  return mapLocation(res.data);
}

export async function loadPricingRecords(params?: {
  crmPartnerId?: string;
}): Promise<PricingRecord[]> {
  const res = await api.get<{ records: ApiPricingRecord[]; total: number }>(
    "/pms/pricing-junction/records",
    {
      params: {
        limit: 5000,
        ...(params?.crmPartnerId && { crm_partner_id: params.crmPartnerId }),
      },
    },
  );
  return (res.data.records ?? []).map(mapRecord);
}

export async function createPricingRecordApi(
  input: PricingRecordInput,
): Promise<PricingRecord> {
  const res = await api.post<ApiPricingRecord>(
    "/pms/pricing-junction/records",
    toApiRecordInput(input),
  );
  return mapRecord(res.data);
}

export async function revisePricingRecordApi(
  sourceRecordId: string,
  input: PricingRecordInput,
): Promise<PricingRecord> {
  const res = await api.post<ApiPricingRecord>(
    `/pms/pricing-junction/records/${sourceRecordId}/revise`,
    toApiRecordInput(input),
  );
  return mapRecord(res.data);
}

export async function deletePricingRecordApi(recordId: string): Promise<void> {
  await api.delete(`/pms/pricing-junction/records/${recordId}`);
}

export function isPricingJunctionMissingError(error: unknown): boolean {
  const ax = error as { response?: { status?: number; data?: { detail?: string } } };
  const detail = String(ax.response?.data?.detail ?? "").toLowerCase();
  return (
    ax.response?.status === 500 &&
    (detail.includes("pricing_locations") ||
      detail.includes("pricing_records") ||
      detail.includes("does not exist") ||
      detail.includes("relation"))
  );
}
