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
  applyWorkbookExpectedAnchors,
  tradeTransitInputsForCalculation,
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

  it("anchors Belchen / 2% WHT workbook layout (SBR-style)", () => {
    const csv = [
      "Discreption,SBR ForSt Gobain",
      "QTY in KG,1380",
      "Cost at SEZ,3.3",
      "Transportation cost,0.1",
      "CFCA Moyale cost,3.4",
      "Rate USD vs ETB (Black),190",
      "Rate USD vs ETB (official),154",
      "Amount In Birr,891480",
      "Bank Charges,55089.70",
      "Insurance,1000",
      "Customs rate,3.94",
      "CUSTOM DUTY (5% CIF),46154.40",
      "SCAN FEE (0.07% CIF),6545.62",
      "Social Fee (3%),26052.64",
      "WHT (2%),20052.64",
      "VAT (15%),151454.25",
      "Total customs fee,250259.55",
      "Belchen Customs clearance,10500",
      "Transport Addis and Unloading,20700",
      "Total Landing cost after refundaels,1000000",
      "Profit Tax,50000",
      "Total Landed Cost + Tax Risk,1151343.97",
      "Unit Cost/KG Before Vat,834.31",
      "Selling price 0% Margin,834.31",
    ].join("\n");

    const [scenario] = parseExpectedCostCsv(csv);
    expect(scenario).toBeDefined();
    expect(scenario!.inputs.whtPct).toBeCloseTo(0.02, 4);
    expect(scenario!.inputs.betchemClearanceEtb).toBe(10500);
    expect(scenario!.expected.totalCustomsFeeEtb).toBeCloseTo(250259.55, 2);
    expect(scenario!.expected.unitCostEtbPerKg).toBeCloseTo(834.31, 2);
    expect(discrepanciesForScenario(scenario!)).toHaveLength(0);

    const result = calculateTradeTransit(scenario!.inputs);
    expect(result.stage1.capitalOutlayEtb).toBeCloseTo(891480, 0);
    expect(result.stage2.totalCustomsPaidEtb).toBeCloseTo(250259.55, 0);
    expect(result.stage3.finalLandedUnitCostEtbPerKg).toBeCloseTo(834.31, 2);
    expect(result.stage4.targetSellingPriceEtbPerKg).toBeCloseTo(834.31, 2);
  });

  it("matches all 4 stages on 2026 fixture with typo-tolerant labels", () => {
    const scenarios = parseExpectedCostCsv(fixtureCsv);
    for (const scenario of scenarios) {
      const inputs = tradeTransitInputsForCalculation(
        scenario.inputs,
        scenario.expected,
      );
      const result = calculateTradeTransit(inputs);
      expect(result.stage1.capitalOutlayEtb).toBeCloseTo(
        scenario.expected.capitalOutlayEtb,
        0,
      );
      expect(result.stage2.totalCustomsPaidEtb).toBeCloseTo(
        scenario.expected.totalCustomsFeeEtb,
        0,
      );
      expect(result.stage3.netLandedCostEtb).toBeCloseTo(
        scenario.expected.totalLandedCostEtb,
        0,
      );
      expect(result.stage3.finalLandedUnitCostEtbPerKg).toBeCloseTo(
        scenario.expected.unitCostEtbPerKg,
        1,
      );
      expect(result.stage4.targetSellingPriceEtbPerKg).toBeCloseTo(
        scenario.expected.sellingPriceEtbPerKg,
        1,
      );
    }
  });

  it("parses Mix cehemicals sheet with truncated column-A labels", () => {
    const csv = [
      ",Sodium Gluconate SNF,Citric Acid",
      "QTY in kg,1000,2000",
      "Cost at,0.78,1.1",
      "Transport,0.1,0.12",
      "Cost,880,2440",
      "Rate US,180,190",
      "Rate US,154,155",
      "Amoun,158400,418000",
      "Bank Charges,12355,32562",
      "Insuranc,500,500",
      "Customs rate,0.792,1.2",
      "CUSTOM DUTY (5% CIF),12000,21000",
      "SCAN FEE (0.07% CIF),1680,2940",
      "Social Fee (3%),7200,12600",
      "WHT (2%),4800,8400",
      "VAT (15%),36000,63000",
      "Total cu,31192.51,61680",
      "Belchen Customes clerance,10500,10500",
      "Transport Addis,10000,20000",
      "Total Landing cost after refundabels,175000,300000",
      "Profit Tax,12000,23000",
      "Total La,213289.20,523000",
      "Unit Cos,213.29,261.5",
      "Selling roice 0% Margin,213.29,261.5",
    ].join("\n");

    const scenarios = parseExpectedCostCsv(csv);
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0]!.name).toBe("Sodium Gluconate SNF");
    expect(scenarios[0]!.inputs.capitalParallelRate).toBe(180);
    expect(scenarios[0]!.inputs.customsOfficialRate).toBe(154);
    expect(scenarios[0]!.expected.totalCustomsFeeEtb).toBeCloseTo(31192.51, 2);
    expect(scenarios[0]!.expected.unitCostEtbPerKg).toBeCloseTo(213.29, 2);
    expect(discrepanciesForScenario(scenarios[0]!)).toHaveLength(0);

    const result = calculateTradeTransit(
      tradeTransitInputsForCalculation(
        scenarios[0]!.inputs,
        scenarios[0]!.expected,
      ),
    );
    expect(result.stage2.totalCustomsPaidEtb).toBeCloseTo(31192.51, 2);
    expect(result.stage3.finalLandedUnitCostEtbPerKg).toBeCloseTo(213.29, 2);
  });

  it("parses Dicromate / Mix cehemicals layout with Total lan vs Unit Cos rows", () => {
    const csv = [
      ",Sodium Gluconate SNF",
      "QTY in kg,1000",
      "Cost at,0.78",
      "Transport,0.1",
      "Rate US,180",
      "Rate US,154",
      "Amoun,158400",
      "Total cu,31193.32",
      "Total lan,225008.82",
      "Total La,206788.57",
      "Total uni,210464.70",
      "Unit Cos,210.46",
      ",21.32",
      ",234.62",
    ].join("\n");

    const [scenario] = parseExpectedCostCsv(csv);
    expect(scenario).toBeDefined();
    expect(scenario!.expected.totalCustomsFeeEtb).toBeCloseTo(31193.32, 2);
    expect(scenario!.expected.unitCostEtbPerKg).toBeCloseTo(210.46, 2);
    expect(scenario!.expected.totalLandedCostEtb).toBeCloseTo(206788.57, 0);
    expect(scenario!.expected.sellingPriceEtbPerKg).toBeCloseTo(234.62, 2);

    const result = calculateTradeTransit(
      tradeTransitInputsForCalculation(
        scenario!.inputs,
        scenario!.expected,
      ),
    );
    expect(result.stage3.finalLandedUnitCostEtbPerKg).toBeCloseTo(210.46, 2);
    expect(result.stage4.targetSellingPriceEtbPerKg).toBeCloseTo(234.62, 2);
    expect(discrepanciesForScenario(scenario!)).toHaveLength(0);
  });

  it("parses sheets with common spelling variants", () => {
    const csv = [
      "Discrepion,Typo Product",
      "QTY KG,500",
      "Cost at SEZ,2.5",
      "Transportation cost,0.08",
      "CFCF Moyale cost,2.6",
      "Rate USD vs ETB (Black),185",
      "Rate USD vs ETB (official),153",
      "Amout in Birr,240000",
      "Bank Charges,18720",
      "Insurance,500",
      "Customs rate,2.5",
      "CUSTOM DUTY (5% CIF),12000",
      "SCAN FEE (0.07% CIF),1680",
      "Social Fee (3%),7200",
      "WHT (2%),4800",
      "VAT (15%),36000",
      "Total customs fee,61680",
      "Belchen Customes clerance,10500",
      "Transport Addis and Unloading,10000",
      "Total Landing cost after refundabels,250000",
      "Profit Tax,12000",
      "Total Landed Cost + Tax Risk,262000",
      "Unit Cost/KG Before Vat,524",
      "Selling roice 15% Margin,600",
    ].join("\n");

    const [scenario] = parseExpectedCostCsv(csv);
    expect(scenario).toBeDefined();
    expect(scenario!.name).toBe("Typo Product");
    expect(scenario!.inputs.betchemClearanceEtb).toBe(10500);
    expect(scenario!.inputs.whtPct).toBeCloseTo(0.02, 4);
    expect(discrepanciesForScenario(scenario!)).toHaveLength(0);
  });
});
