import type { ExpectedCostScenario } from "./expectedCostCsv";
import {
  calculateMarginFromSellingPrice,
  calculateTradeTransit,
  type SellingPriceMode,
  type TradeTransitResult,
} from "./tradeTransitCalc";

export type WorkbookSellingResolution = {
  sellingPriceMode: SellingPriceMode;
  targetSellingPriceEtbPerKg: number;
  targetMarginPct: number;
  usesExcelSellingPrice: boolean;
};

/** Backtrack gross margin % from workbook unit cost and selling price (may be negative). */
export function inferMarginPctFromWorkbook(
  sellingPriceEtbPerKg: number,
  unitCostEtbPerKg: number,
): number | null {
  if (sellingPriceEtbPerKg <= 0 || unitCostEtbPerKg <= 0) return null;
  return calculateMarginFromSellingPrice(
    unitCostEtbPerKg,
    sellingPriceEtbPerKg,
    2,
  ).grossMarginPct;
}

/**
 * Prefer Excel selling price (manual mode). Only use margin-mode when sell price is absent.
 * Never substitute a default margin when the workbook already states a sell price.
 */
export function resolveWorkbookSellingInputs(
  sellingPriceEtbPerKg: number,
  unitCostEtbPerKg: number,
  explicitMarginPct: number,
): WorkbookSellingResolution {
  if (sellingPriceEtbPerKg > 0) {
    const backtracked = inferMarginPctFromWorkbook(
      sellingPriceEtbPerKg,
      unitCostEtbPerKg,
    );
    return {
      sellingPriceMode: "manual",
      targetSellingPriceEtbPerKg: sellingPriceEtbPerKg,
      targetMarginPct: backtracked ?? explicitMarginPct,
      usesExcelSellingPrice: true,
    };
  }

  if (explicitMarginPct !== 0) {
    return {
      sellingPriceMode: "margin",
      targetSellingPriceEtbPerKg: 0,
      targetMarginPct: explicitMarginPct,
      usesExcelSellingPrice: false,
    };
  }

  return {
    sellingPriceMode: "margin",
    targetSellingPriceEtbPerKg: 0,
    targetMarginPct: 0,
    usesExcelSellingPrice: false,
  };
}

export type WorkbookDiscrepancy = {
  label: string;
  workbookValue: number;
  calculatedValue: number;
  delta: number;
  deltaPct: number;
};

function relativeDelta(workbook: number, calculated: number): number {
  if (workbook === 0 && calculated === 0) return 0;
  const base =
    Math.abs(workbook) > 0 ? Math.abs(workbook) : Math.abs(calculated);
  return base > 0 ? Math.abs(calculated - workbook) / base : 0;
}

/** Compare waterfall output to workbook reference totals (for advisory warnings only). */
export function findWorkbookDiscrepancies(
  scenario: ExpectedCostScenario,
  result: TradeTransitResult,
  tolerancePct = 0.03,
): WorkbookDiscrepancy[] {
  const exp = scenario.expected;
  const checks: Array<{
    label: string;
    workbook: number;
    calculated: number;
  }> = [
    {
      label: "Total customs fee",
      workbook: exp.totalCustomsFeeEtb,
      calculated: result.stage2.totalCustomsPaidEtb,
    },
    {
      label: "Total landed cost",
      workbook: exp.totalLandedCostEtb,
      calculated: result.stage3.netLandedCostEtb,
    },
    {
      label: "Unit cost / kg",
      workbook: exp.unitCostEtbPerKg,
      calculated: result.stage3.finalLandedUnitCostEtbPerKg,
    },
  ];

  return checks
    .filter((row) => row.workbook > 0)
    .map((row) => {
      const delta = row.calculated - row.workbook;
      return {
        label: row.label,
        workbookValue: row.workbook,
        calculatedValue: row.calculated,
        delta,
        deltaPct: relativeDelta(row.workbook, row.calculated) * 100,
      };
    })
    .filter((row) => relativeDelta(row.workbookValue, row.calculatedValue) > tolerancePct);
}

export function discrepanciesForScenario(
  scenario: ExpectedCostScenario,
  tolerancePct = 0.03,
): WorkbookDiscrepancy[] {
  const result = calculateTradeTransit(scenario.inputs);
  return findWorkbookDiscrepancies(scenario, result, tolerancePct);
}
