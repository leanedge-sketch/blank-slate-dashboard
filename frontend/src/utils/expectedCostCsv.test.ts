import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculateTradeTransit } from "./tradeTransitCalc";
import { parseExpectedCostCsv, parseWorkbookMetadata } from "./expectedCostCsv";
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

    const mResult = calculateTradeTransit(metacel!.inputs);
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

    const cResult = calculateTradeTransit(cellocel!.inputs);
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
});
