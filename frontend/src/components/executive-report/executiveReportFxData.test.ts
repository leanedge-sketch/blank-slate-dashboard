import { describe, expect, it } from "vitest";
import {
  buildCurrencyLedger,
  buildCustomerFxMatrix,
  buildFxKpis,
  buildFxSpreadSeries,
  buildMarginByCurrency,
} from "./executiveReportFxData";
import type { EnrichedShipment } from "./executiveReportTypes";

function shipment(overrides: Partial<EnrichedShipment>): EnrichedShipment {
  return {
    id: "s1",
    productId: "p1",
    productName: "Caustic",
    customerId: "c1",
    customerName: "Acme",
    quantityKg: 1000,
    createdAt: "2025-03-15T10:00:00Z",
    currency: "ETB",
    officialRate: 120,
    parallelRate: 150,
    fxSpread: 30,
    originOutlayEtb: 100_000,
    customsEtb: 20_000,
    transitEtb: 5_000,
    profitEtb: 25_000,
    revenueEtb: 150_000,
    revenueUsd: 1000,
    landedCostEtb: 125_000,
    marginPct: 16.7,
    profitPerKgEtb: 25,
    ...overrides,
  };
}

describe("executiveReportFxData", () => {
  const rows: EnrichedShipment[] = [
    shipment({ id: "1", currency: "USD", revenueUsd: 5000, revenueEtb: 750_000, marginPct: 22 }),
    shipment({
      id: "2",
      customerId: "c2",
      customerName: "Beta",
      currency: "ETB",
      revenueEtb: 200_000,
      marginPct: 12,
      createdAt: "2025-04-01T10:00:00Z",
    }),
    shipment({
      id: "3",
      customerId: "c2",
      customerName: "Beta",
      currency: "USD",
      revenueUsd: 2000,
      revenueEtb: 300_000,
      marginPct: 18,
      createdAt: "2025-04-10T10:00:00Z",
    }),
  ];

  it("buildFxKpis splits USD and ETB revenue and margins", () => {
    const kpis = buildFxKpis(rows);
    expect(kpis.totalUsdRevenue).toBe(7000);
    expect(kpis.totalEtbRevenue).toBe(200_000);
    expect(kpis.usdAvgMarginPct).toBeCloseTo(20, 0);
    expect(kpis.etbAvgMarginPct).toBeCloseTo(12, 0);
  });

  it("buildMarginByCurrency returns both currencies", () => {
    const points = buildMarginByCurrency(rows);
    expect(points).toHaveLength(2);
    expect(points.find((p) => p.currency === "USD")?.shipmentCount).toBe(2);
    expect(points.find((p) => p.currency === "ETB")?.shipmentCount).toBe(1);
  });

  it("buildCustomerFxMatrix stacks revenue by customer", () => {
    const matrix = buildCustomerFxMatrix(rows);
    const beta = matrix.find((r) => r.name === "Beta");
    expect(beta?.totalRevenueEtb).toBe(500_000);
    expect(beta?.usdSharePct).toBeCloseTo(60, 0);
    expect(beta?.etbSharePct).toBeCloseTo(40, 0);
  });

  it("buildFxSpreadSeries buckets by month", () => {
    const series = buildFxSpreadSeries(rows);
    expect(series.length).toBeGreaterThanOrEqual(2);
    expect(series[0].fxSpread).toBe(30);
  });

  it("buildCurrencyLedger picks dominant currency", () => {
    const ledger = buildCurrencyLedger(rows);
    const beta = ledger.find((r) => r.name === "Beta");
    expect(beta?.dominantCurrency).toBe("USD");
    const acme = ledger.find((r) => r.name === "Acme");
    expect(acme?.dominantCurrency).toBe("USD");
  });
});
