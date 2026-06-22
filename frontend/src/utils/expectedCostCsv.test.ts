import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculateTradeTransit } from "./tradeTransitCalc";
import { parseExpectedCostCsv } from "./expectedCostCsv";
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
});
