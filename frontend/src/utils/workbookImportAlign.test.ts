import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseExpectedCostCsv } from "./expectedCostCsv";
import { calculateTradeTransit } from "./tradeTransitCalc";
import {
  discrepanciesForScenario,
  inferMarginPctFromWorkbook,
  resolveWorkbookSellingInputs,
} from "./workbookImportAlign";

const fixtureCsv = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../data/expected-cost-2026.csv"),
  "utf8",
);

describe("workbookImportAlign", () => {
  it("uses manual sell price from workbook and backtracks margin", () => {
    const resolution = resolveWorkbookSellingInputs(370, 314, 18);
    expect(resolution.sellingPriceMode).toBe("manual");
    expect(resolution.targetSellingPriceEtbPerKg).toBe(370);
    expect(resolution.usesExcelSellingPrice).toBe(true);
    expect(resolution.targetMarginPct).toBeCloseTo(15.14, 1);
  });

  it("allows negative margin when selling below unit cost", () => {
    const margin = inferMarginPctFromWorkbook(250, 314);
    expect(margin).not.toBeNull();
    expect(margin!).toBeLessThan(0);
    const resolution = resolveWorkbookSellingInputs(250, 314, 10);
    expect(resolution.sellingPriceMode).toBe("manual");
    expect(resolution.targetSellingPriceEtbPerKg).toBe(250);
    expect(resolution.targetMarginPct).toBeLessThan(0);
  });

  it("parsed workbook keeps Excel selling price in calculator output", () => {
    const csv = [
      "Mix Chemical,Loss Product,",
      "QTY in KG,1000,",
      "Supplier base price,1.1,",
      "Transportation cost,0.14,",
      "CFCA Moyale cost,1.25,",
      "Capital/parallel rate,180,",
      "Customs official rate,155,",
      "Base customs reference,0.792,",
      "Amount In Birr,225000,",
      "Bank Charges,17550,",
      "Insurance,500,",
      "Total customs fee,120000,",
      "Betchem,13500,",
      "Transport Addis and Unloading,10000,",
      "Total Landing cost after refundaels,300000,",
      "Profit Tax,14000,",
      "Total Landed Cost + Tax Risk,314000,",
      "Unit Cost/KG,314,",
      "Selling price,250,",
    ].join("\n");

    const [scenario] = parseExpectedCostCsv(csv);
    expect(scenario.inputs.sellingPriceMode).toBe("manual");
    expect(scenario.inputs.targetSellingPriceEtbPerKg).toBe(250);
    expect(scenario.inputs.targetMarginPct).toBeLessThan(0);

    const result = calculateTradeTransit(scenario.inputs);
    expect(result.stage4.targetSellingPriceEtbPerKg).toBe(250);
    expect(result.stage4.grossMarginPct).toBeLessThan(0);
    expect(discrepanciesForScenario(scenario)).toHaveLength(0);
  });

  it("anchors 2026 fixture totals from Excel with no waterfall drift", () => {
    const scenarios = parseExpectedCostCsv(fixtureCsv);
    expect(scenarios.length).toBeGreaterThan(0);
    for (const scenario of scenarios) {
      expect(discrepanciesForScenario(scenario)).toHaveLength(0);
    }
  });
});
