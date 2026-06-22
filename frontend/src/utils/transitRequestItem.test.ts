import { describe, expect, it } from "vitest";
import { DEFAULT_TRADE_TRANSIT_INPUTS, calculateTradeTransit } from "./tradeTransitCalc";
import {
  aggregateTransitFinancialTotals,
  mapTransitRequestItem,
  marginPctFromSelling,
} from "./transitRequestItem";

describe("transitRequestItem", () => {
  it("maps calculator output to accounting row fields", () => {
    const result = calculateTradeTransit(DEFAULT_TRADE_TRANSIT_INPUTS);
    const item = mapTransitRequestItem(
      "line-1",
      "Sodium Gluconate",
      DEFAULT_TRADE_TRANSIT_INPUTS,
      result,
    );

    expect(item.productName).toBe("Sodium Gluconate");
    expect(item.uom).toBe("KG");
    expect(item.quantity).toBe(20000);
    expect(item.landedPerUnit).toBeCloseTo(275.7577, 2);
    expect(item.costBreakdown.fobPrice).toBeGreaterThan(0);
    expect(item.costBreakdown.customsDuty).toBeGreaterThan(0);
    expect(item.financial.baseCurrency).toBe("USD");
    expect(item.financial.targetCurrency).toBe("ETB");
    expect(item.financial.isVatInclusive).toBe(false);
  });

  it("computes margin as profit divided by selling price", () => {
    expect(marginPctFromSelling(34.47, 310.23)).toBeCloseTo(11.11, 1);
  });

  it("aggregates financial footer totals", () => {
    const result = calculateTradeTransit(DEFAULT_TRADE_TRANSIT_INPUTS);
    const item = mapTransitRequestItem(
      "a",
      "Product A",
      DEFAULT_TRADE_TRANSIT_INPUTS,
      result,
    );
    const totals = aggregateTransitFinancialTotals([item]);

    expect(totals.totalCost).toBe(item.totalCost);
    expect(totals.totalRevenue).toBe(item.revenue);
    expect(totals.netProfit).toBeCloseTo(item.revenue - item.totalCost, 2);
  });
});
