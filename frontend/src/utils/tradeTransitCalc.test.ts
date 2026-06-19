import { describe, expect, it } from "vitest";
import {
  calculateSellingPriceFromTargetMargin,
} from "./tradeTransitCalc";

describe("calculateSellingPriceFromTargetMargin", () => {
  const unitCost = 275.7576768;
  const targetMarginDecimal = 0.2;

  it("computes true gross margin price from unit cost (20% target, full precision)", () => {
    const result = calculateSellingPriceFromTargetMargin(
      unitCost,
      targetMarginDecimal,
      7,
    );

    expect(result.sellingPrice).toBeCloseTo(344.697096, 6);
    expect(result.marginValue).toBeCloseTo(68.9394192, 6);
    expect(result.grossMarginDecimal).toBeCloseTo(0.2, 6);
  });

  it("rounds to 4 decimal places for ledger storage", () => {
    const result = calculateSellingPriceFromTargetMargin(
      unitCost,
      targetMarginDecimal,
      4,
    );

    expect(result.sellingPrice).toBe(344.6971);
    expect(result.marginValue).toBe(68.9394);
    expect(result.grossMarginDecimal).toBeCloseTo(0.2, 2);
  });

  it("rejects margin at or above 100%", () => {
    expect(() =>
      calculateSellingPriceFromTargetMargin(100, 1, 4),
    ).toThrow();
  });
});
