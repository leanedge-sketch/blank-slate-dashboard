import { describe, expect, it } from "vitest";
import { calculateCustomsDutyAssessment } from "./customsDutyCalc";
import { DEFAULT_FINANCE_CONSTANTS } from "./importFinanceCalc";
import {
  calculateSellingPriceFromTargetMargin,
  calculateTradeTransit,
  DEFAULT_TRADE_TRANSIT_INPUTS,
} from "./tradeTransitCalc";

describe("calculateCustomsDutyAssessment", () => {
  const exampleInput = {
    quantityKg: 20000,
    customsRateUsdPerKg: 0.792,
    officialExchangeRate: 156,
    cifFreightInsuranceBufferPct: 0.1,
    customsDutyPct: 0.05,
    scanFeePct: 0.007,
    socialFeePct: 0.03,
    whtPct: 0.03,
    vatPct: 0.15,
  };

  it("computes FOB → CIF assessment base with 10% freight/insurance buffer", () => {
    const result = calculateCustomsDutyAssessment(exampleInput);

    expect(result.fobValueEtb).toBe(2471040);
    expect(result.cifValueEtb).toBe(2718144);
  });

  it("matches legacy Excel scan fee (label 0.07%, multiplier 0.007)", () => {
    const result = calculateCustomsDutyAssessment(exampleInput);

    expect(result.scanFeeEtb).toBe(19027.01);
    expect(result.cifValueEtb * 0.007).toBeCloseTo(19027.008, 3);
  });

  it("computes VAT on CIF + duty + social, not CIF alone", () => {
    const result = calculateCustomsDutyAssessment(exampleInput);

    expect(result.vatBaseEtb).toBe(2935595.52);
    expect(result.vatEtb).toBeCloseTo(440339.328, 3);
    expect(result.cifValueEtb * 0.15).not.toBeCloseTo(result.vatEtb, 0);
  });

  it("matches legacy Excel total customs fee for 20,000 kg", () => {
    const result = calculateCustomsDutyAssessment(exampleInput);

    expect(result.totalCustomsFeeEtb).toBe(758362.18);
    expect(result.totalCustomsFeeEtb).toBeLessThan(result.cifValueEtb);
  });

  it("uses 0.007 scan multiplier from default finance constants", () => {
    expect(DEFAULT_FINANCE_CONSTANTS.scanFeePct).toBe(0.007);

    const result = calculateCustomsDutyAssessment({
      quantityKg: 20000,
      customsRateUsdPerKg: 0.792,
      officialExchangeRate: 156,
    });

    expect(result.scanFeeEtb).toBe(19027.01);
    expect(result.totalCustomsFeeEtb).toBe(758362.18);
  });
});

describe("calculateTradeTransit stage 2", () => {
  it("excludes CIF assessment base from gross investment", () => {
    const result = calculateTradeTransit(DEFAULT_TRADE_TRANSIT_INPUTS);

    expect(result.stage2.cifBaseEtb).toBe(2718144);
    expect(result.stage2.scanFeeEtb).toBe(19027.01);
    expect(result.stage2.totalCustomsPaidEtb).toBe(758362.18);
    expect(result.stage3.grossInvestmentEtb).toBe(
      result.stage1.capitalOutlayEtb +
        result.stage2.totalCustomsPaidEtb +
        result.stage3.inlandTransportEtb,
    );
    expect(result.stage3.grossInvestmentEtb).toBeLessThan(
      result.stage1.capitalOutlayEtb +
        result.stage2.cifBaseEtb +
        result.stage2.totalCustomsPaidEtb,
    );
  });
});

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
