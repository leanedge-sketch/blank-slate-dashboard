import { describe, expect, it } from "vitest";
import { EXPECTED_COST_2026_SCENARIOS } from "../data/expectedCost2026Scenarios";
import {
  createTradeTransitRequest,
  scenariosToTradeTransitRequest,
  summarizeTradeTransitRequest,
} from "./tradeTransitRequest";
import { DEFAULT_FINANCE_CONSTANTS } from "./importFinanceCalc";

describe("tradeTransitRequest", () => {
  it("builds a multi-product request from CSV scenarios", () => {
    const request = scenariosToTradeTransitRequest(
      EXPECTED_COST_2026_SCENARIOS,
      "Acme Trading",
    );

    expect(request.clientName).toBe("Acme Trading");
    expect(request.lines).toHaveLength(2);
    expect(request.lines[0].productName).toBe("Metacel RDP");
    expect(request.lines[1].productName).toBe("Cellocel");
  });

  it("aggregates totals across products for one client", () => {
    const request = scenariosToTradeTransitRequest(
      EXPECTED_COST_2026_SCENARIOS,
      "Acme Trading",
    );
    const summary = summarizeTradeTransitRequest(
      request,
      DEFAULT_FINANCE_CONSTANTS,
    );

    expect(summary.totals.quantityKg).toBe(16500);
    expect(summary.totals.totalRevenue).toBeGreaterThan(0);
    expect(summary.totals.expectedRevenueEtb).toBeGreaterThan(0);
    expect(summary.items).toHaveLength(2);
    expect(summary.lines).toHaveLength(2);
  });

  it("starts with one default product line", () => {
    const request = createTradeTransitRequest("Test Client");
    expect(request.lines).toHaveLength(1);
    expect(request.clientName).toBe("Test Client");
  });
});
