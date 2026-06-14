import type { CRMPartner, PMSProduct, PricingLocation, PricingRecordInput } from "./types";

const DEMO_SEED_KEY = "pricing-costing-demo-seeded-v1";

/** Build two demo rows tied to real CRM buyer + PMS product ids (for empty DBs). */
export function buildDemoPricingInputs(
  partners: CRMPartner[],
  products: PMSProduct[],
  locations: PricingLocation[],
): PricingRecordInput[] {
  const buyer =
    partners.find((p) => p.partnerKind === "crm" && p.type === "buyer") ??
    partners.find((p) => p.partnerKind === "crm") ??
    partners[0];
  const supplier =
    partners.find((p) => p.partnerKind === "pms" && p.type === "supplier") ??
    partners.find((p) => p.partnerKind === "pms") ??
    partners[1];
  const productA = products[0];
  const productB = products[1] ?? products[0];
  const location =
    locations.find((l) => l.city?.toLowerCase().includes("mombasa")) ??
    locations[0];

  if (!buyer || !productA || !location) return [];

  const rows: PricingRecordInput[] = [
    {
      crmPartnerId: buyer.id,
      partnerKind: buyer.partnerKind,
      pmsProductId: productA.id,
      incoterm: "FOB",
      locationId: location.id,
      costCurrency: "USD",
      costAmount: 1150,
      priceCurrency: "KES",
      priceAmount: 162000,
      needsCurrencyConversion: true,
      exchangeRateUsed: 129.5,
      baseCurrency: "KES",
    },
    {
      crmPartnerId: buyer.id,
      partnerKind: buyer.partnerKind,
      pmsProductId: productA.id,
      incoterm: "FOB",
      locationId: location.id,
      costCurrency: "USD",
      costAmount: 1180,
      priceCurrency: "KES",
      priceAmount: 168500,
      needsCurrencyConversion: true,
      exchangeRateUsed: 129.5,
      baseCurrency: "KES",
    },
  ];

  if (supplier && productB && supplier.id !== buyer.id) {
    rows.push({
      crmPartnerId: supplier.id,
      partnerKind: supplier.partnerKind,
      pmsProductId: productB.id,
      incoterm: "CFR",
      locationId: location.id,
      costCurrency: "USD",
      costAmount: 1420,
      priceCurrency: "USD",
      priceAmount: 1595,
      needsCurrencyConversion: false,
      exchangeRateUsed: null,
      baseCurrency: "USD",
    });
  }

  return rows;
}

export function demoSeedAlreadyAttempted(): boolean {
  try {
    return sessionStorage.getItem(DEMO_SEED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDemoSeedAttempted(): void {
  try {
    sessionStorage.setItem(DEMO_SEED_KEY, "1");
  } catch {
    // ignore
  }
}

/** First demo row is written as historical; rest as active (shows time-series UI). */
export function demoRecordStatus(index: number): "active" | "historical" {
  return index === 0 ? "historical" : "active";
}

export function demoRecordValidTo(index: number, today: string): string | null {
  return index === 0 ? today : null;
}

export function demoRecordValidFrom(index: number, today: string): string {
  return index === 0 ? "2025-06-01" : today;
}
