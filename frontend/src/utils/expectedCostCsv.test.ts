import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculateTradeTransit } from "./tradeTransitCalc";
import {
  detectWorkbookDelimiter,
  extractAnchoredValue,
  findAnchoredRow,
  parseExpectedCostCsv,
  parseWorkbookMetadata,
} from "./expectedCostCsv";
import { tradeTransitInputsForCalculation } from "./workbookImportAlign";
import { EXPECTED_COST_2026_SCENARIOS } from "../data/expectedCost2026Scenarios";

const fixtureCsv = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../data/expected-cost-2026.csv"),
  "utf8",
);

describe("parseExpectedCostCsv", () => {
  it("parses Metacel RDP and Cellocel columns", () => {
    const scenarios = parseExpectedCostCsv(fixtureCsv);

    expect(scenarios).toHaveLength(2);
    expect(scenarios[0].name).toBe("Metacel RDP");
    expect(scenarios[1].name).toBe("Cellocel");
    expect(scenarios[0].inputs.quantityKg).toBe(15000);
    expect(scenarios[1].inputs.quantityKg).toBe(1500);
    expect(scenarios[0].inputs.baseCustomsReferenceUsd).toBe(3.8);
    expect(scenarios[1].inputs.baseCustomsReferenceUsd).toBe(6.67);
    expect(scenarios[0].inputs.customsOfficialRate).toBe(155);
    expect(scenarios[0].inputs.inlandClearancePerKgEtb).toBe(10);
  });

  it("bundled 2026 scenarios match spreadsheet reference totals", () => {
    const metacel = EXPECTED_COST_2026_SCENARIOS.find((s) => s.id === "metacel-rdp");
    const cellocel = EXPECTED_COST_2026_SCENARIOS.find((s) => s.id === "cellocel");
    expect(metacel).toBeDefined();
    expect(cellocel).toBeDefined();

    const mResult = calculateTradeTransit(
      tradeTransitInputsForCalculation(metacel!.inputs, metacel!.expected),
    );
    expect(mResult.stage2.totalCustomsPaidEtb).toBeCloseTo(
      metacel!.expected.totalCustomsFeeEtb,
      0,
    );
    expect(mResult.stage3.netLandedCostEtb).toBeCloseTo(
      metacel!.expected.totalLandedCostEtb,
      0,
    );
    expect(mResult.stage3.finalLandedUnitCostEtbPerKg).toBeCloseTo(
      metacel!.expected.unitCostEtbPerKg,
      1,
    );
    expect(mResult.stage4.targetSellingPriceEtbPerKg).toBeCloseTo(
      metacel!.expected.sellingPriceEtbPerKg,
      1,
    );

    const cResult = calculateTradeTransit(
      tradeTransitInputsForCalculation(cellocel!.inputs, cellocel!.expected),
    );
    expect(cResult.stage2.totalCustomsPaidEtb).toBeCloseTo(
      cellocel!.expected.totalCustomsFeeEtb,
      0,
    );
    expect(cResult.stage3.netLandedCostEtb).toBeCloseTo(
      cellocel!.expected.totalLandedCostEtb,
      0,
    );
    expect(cResult.stage3.finalLandedUnitCostEtbPerKg).toBeCloseTo(
      cellocel!.expected.unitCostEtbPerKg,
      1,
    );
  });

  it("parses Excel clipboard paste (tab-separated) the same as CSV", () => {
    const csv = fixtureCsv;
    const tsv = csv
      .split("\n")
      .map((line) => line.split(",").join("\t"))
      .join("\n");

    expect(detectWorkbookDelimiter(tsv)).toBe("\t");
    expect(detectWorkbookDelimiter(csv)).toBe(",");

    const fromCsv = parseExpectedCostCsv(csv);
    const fromPaste = parseExpectedCostCsv(tsv);
    expect(fromPaste).toHaveLength(fromCsv.length);
    expect(fromPaste[0]!.name).toBe(fromCsv[0]!.name);
    expect(fromPaste[0]!.expected.capitalOutlayEtb).toBe(
      fromCsv[0]!.expected.capitalOutlayEtb,
    );
    expect(fromPaste[0]!.expected.unitCostEtbPerKg).toBe(
      fromCsv[0]!.expected.unitCostEtbPerKg,
    );
  });

  it("parses workbook metadata rows when present", () => {
    const csv = [
      "Customer name,Acme Trading,,,,",
      "Contact person,Jane Doe,,,,",
      "Request date,2026-03-15,,,,",
      "Pipeline number,TT-20260315-1001,,,,",
      "Discreption,Product A,,,,",
      "QTY in KG,1000,,,,",
      "purchasing price,2,,,,",
      "transportation cost,0.1,,,,",
      "CFCA Moyale cost,2.1,,,,",
      "Rate USD vs ETB (Black),190,,,,",
      "Rate USD vs ETB (official),155,,,,",
      "customs rate,3.8,,,,",
    ].join("\n");

    const metadata = parseWorkbookMetadata(csv);
    expect(metadata.clientName).toBe("Acme Trading");
    expect(metadata.contactPerson).toBe("Jane Doe");
    expect(metadata.requestDate).toBe("2026-03-15");
    expect(metadata.requestRef).toBe("TT-20260315-1001");

    const scenarios = parseExpectedCostCsv(csv);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].name).toBe("Product A");
  });

  it("parses Mix chemicals layout with dynamic anchors regardless of row order", () => {
    const csv = [
      "Customer name,Acme Mix Co,,",
      "Target gross margin,20,,",
      "Mix Chemical,Sodium Gluconate,Citric Acid,",
      "Customs official rate,155,155,",
      "Capital/parallel rate,180,190,",
      "Base customs reference,0.792,1.2,",
      "Supplier base price,1.1,0.95,",
      "QTY in KG,1000,2000,",
      "Transportation cost,0.14,0.12,",
      "CFCA Moyale cost,1.25,1.1,",
      "Amount In Birr,225000,418000,",
      "Bank Charges,17550,32562,",
      "Insurance,500,500,",
      "Total customs fee,120000,210000,",
      "Betchem,13500,13500,",
      "Transport Addis and Unloading,10000,20000,",
      "Total Landing cost after refundaels,300000,500000,",
      "Profit Tax,14000,23000,",
      "Total Landed Cost + Tax Risk,314000,523000,",
      "Unit Cost/KG,314,261.5,",
      "Selling price 18% Margin,370,308,",
    ].join("\n");

    const scenarios = parseExpectedCostCsv(csv);
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0]!.name).toBe("Sodium Gluconate");
    expect(scenarios[0]!.inputs.supplierBasePriceUsd).toBe(1.1);
    expect(scenarios[0]!.inputs.baseCustomsReferenceUsd).toBe(0.792);
    expect(scenarios[0]!.inputs.capitalParallelRate).toBe(180);
    expect(scenarios[0]!.inputs.customsOfficialRate).toBe(155);
    expect(scenarios[0]!.inputs.targetMarginPct).toBeCloseTo(15.14, 1);
    expect(scenarios[0]!.inputs.sellingPriceMode).toBe("manual");
    expect(scenarios[0]!.inputs.targetSellingPriceEtbPerKg).toBe(370);
    expect(scenarios[1]!.inputs.capitalParallelRate).toBe(190);
    expect(scenarios[1]!.inputs.sellingPriceMode).toBe("manual");
    expect(scenarios[1]!.inputs.targetSellingPriceEtbPerKg).toBe(308);

    const result = calculateTradeTransit(scenarios[0]!.inputs);
    expect(result.stage1.capitalParallelRate).toBe(180);
    expect(result.stage2.customsOfficialRate).toBe(155);
    expect(result.stage1.capitalParallelRate).not.toBe(result.stage2.customsOfficialRate);
    expect(result.stage4.targetSellingPriceEtbPerKg).toBe(370);
  });

  it("keeps capital parallel and customs official rates on separate anchor rows", () => {
    const rows = [
      ["Rate USD vs ETB (Black)", "190", "190"],
      ["Rate USD vs ETB (official)", "155", "155"],
      ["Rate USD vs ETB (Dashen Black)", "180", "180"],
      ["Customs official rate", "156", "156"],
      ["Capital/parallel rate", "175", "175"],
    ];

    expect(extractAnchoredValue(rows, "capitalParallelRate", 1)).toBe(175);
    expect(extractAnchoredValue(rows, "customsOfficialRate", 1)).toBe(156);
    expect(findAnchoredRow(rows, "capitalParallelRate")?.[0]).toContain("parallel");
    expect(findAnchoredRow(rows, "customsOfficialRate")?.[0]).toContain("official");
  });
});
