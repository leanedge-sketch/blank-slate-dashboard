import expectedCostCsv from "./expected-cost-2026.csv?raw";
import {
  parseExpectedCostCsv,
  type ExpectedCostScenario,
} from "../utils/expectedCostCsv";

/** Scenarios from expected-cost-2026.csv (Metacel RDP, Cellocel). */
export const EXPECTED_COST_2026_SCENARIOS: ExpectedCostScenario[] =
  parseExpectedCostCsv(expectedCostCsv);

export function getExpectedCostScenario(
  id: string,
): ExpectedCostScenario | undefined {
  return EXPECTED_COST_2026_SCENARIOS.find((s) => s.id === id);
}
