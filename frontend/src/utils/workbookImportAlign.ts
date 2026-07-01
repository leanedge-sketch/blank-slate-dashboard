import type { ExpectedCostScenario } from "./expectedCostCsv";
import {
  DEFAULT_FINANCE_CONSTANTS,
  type FinanceConstants,
} from "./importFinanceCalc";
import {
  calculateMarginFromSellingPrice,
  calculateSellingPriceFromTargetMargin,
  calculateTradeTransit,
  type SellingPriceMode,
  type TradeTransitInputs,
  type TradeTransitResult,
} from "./tradeTransitCalc";

export function applyWorkbookExpectedAnchors(
  inputs: TradeTransitInputs,
  expected: ExpectedCostScenario["expected"],
): TradeTransitInputs {
  return {
    ...inputs,
    fixedCapitalOutlayEtb:
      expected.capitalOutlayEtb > 0 ? expected.capitalOutlayEtb : inputs.fixedCapitalOutlayEtb,
    workbookTotalCustomsFeeEtb:
      expected.totalCustomsFeeEtb > 0 ? expected.totalCustomsFeeEtb : null,
    workbookNetLandedCostEtb:
      expected.totalLandedCostEtb > 0 ? expected.totalLandedCostEtb : null,
    workbookUnitCostEtbPerKg:
      expected.unitCostEtbPerKg > 0 ? expected.unitCostEtbPerKg : null,
  };
}

/** Merge workbook reference totals before running the waterfall (import or saved snapshot). */
export function tradeTransitInputsForCalculation(
  inputs: TradeTransitInputs,
  expected?: ExpectedCostScenario["expected"] | null,
): TradeTransitInputs {
  if (!expected) return inputs;
  const anchored = applyWorkbookExpectedAnchors(inputs, expected);
  if (expected.sellingPriceEtbPerKg > 0) {
    return {
      ...anchored,
      sellingPriceMode: "manual",
      targetSellingPriceEtbPerKg: expected.sellingPriceEtbPerKg,
      targetMarginPct: expected.targetMarginPct,
    };
  }
  return anchored;
}

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

/** Compare waterfall output to workbook reference totals (all 4 stages). */
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
      label: "Stage 1 — capital outlay",
      workbook: exp.capitalOutlayEtb,
      calculated: result.stage1.capitalOutlayEtb,
    },
    {
      label: "Stage 2 — total customs fee",
      workbook: exp.totalCustomsFeeEtb,
      calculated: result.stage2.totalCustomsPaidEtb,
    },
    {
      label: "Stage 3 — total landed cost",
      workbook: exp.totalLandedCostEtb,
      calculated: result.stage3.netLandedCostEtb,
    },
    {
      label: "Stage 3 — unit cost / kg",
      workbook: exp.unitCostEtbPerKg,
      calculated: result.stage3.finalLandedUnitCostEtbPerKg,
    },
    {
      label: "Stage 4 — selling price / kg",
      workbook: exp.sellingPriceEtbPerKg,
      calculated: result.stage4.targetSellingPriceEtbPerKg,
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
  const result = tradeTransitDisplayResult(
    scenario.inputs,
    scenario.expected,
  );
  return findWorkbookDiscrepancies(scenario, result, tolerancePct);
}

/**
 * When workbook reference totals exist, show those Excel values in the UI
 * instead of recomputing stage KPIs from edited inputs.
 */
export function tradeTransitDisplayResult(
  inputs: TradeTransitInputs,
  expected?: ExpectedCostScenario["expected"] | null,
  constants: FinanceConstants = DEFAULT_FINANCE_CONSTANTS,
): TradeTransitResult {
  const calcInputs = tradeTransitInputsForCalculation(inputs, expected);
  const result = calculateTradeTransit(calcInputs, constants);
  if (!expected) return result;
  return overlayWorkbookExpectedOnResult(result, expected, inputs);
}

function overlayWorkbookExpectedOnResult(
  result: TradeTransitResult,
  expected: ExpectedCostScenario["expected"],
  inputs: TradeTransitInputs,
): TradeTransitResult {
  const qty = Math.max(inputs.quantityKg, 0);

  const stage1 =
    expected.capitalOutlayEtb > 0
      ? {
          ...result.stage1,
          capitalOutlayEtb: expected.capitalOutlayEtb,
        }
      : result.stage1;

  const stage2 =
    expected.totalCustomsFeeEtb > 0
      ? {
          ...result.stage2,
          totalCustomsPaidEtb: expected.totalCustomsFeeEtb,
        }
      : result.stage2;

  const unitCost =
    expected.unitCostEtbPerKg > 0
      ? expected.unitCostEtbPerKg
      : result.stage3.finalLandedUnitCostEtbPerKg;

  const stage3 =
    expected.totalLandedCostEtb > 0 || expected.unitCostEtbPerKg > 0
      ? {
          ...result.stage3,
          ...(expected.totalLandedCostEtb > 0
            ? { netLandedCostEtb: expected.totalLandedCostEtb }
            : {}),
          ...(expected.unitCostEtbPerKg > 0
            ? { finalLandedUnitCostEtbPerKg: expected.unitCostEtbPerKg }
            : {}),
        }
      : result.stage3;

  let stage4 = {
    ...result.stage4,
    unitCostEtbPerKg: unitCost,
  };

  if (expected.sellingPriceEtbPerKg > 0) {
    const manual = calculateMarginFromSellingPrice(
      unitCost,
      expected.sellingPriceEtbPerKg,
      4,
    );
    stage4 = {
      ...stage4,
      targetSellingPriceEtbPerKg: expected.sellingPriceEtbPerKg,
      profitPerKgEtb: manual.marginValue,
      grossMarginPct: expected.targetMarginPct || manual.grossMarginPct,
      totalExpectedRevenueEtb: expected.sellingPriceEtbPerKg * qty,
      sellingPriceMode: "manual",
      targetMarginPct: expected.targetMarginPct || manual.grossMarginPct,
    };
  } else if (expected.unitCostEtbPerKg > 0 && expected.targetMarginPct !== 0) {
    const priced = calculateSellingPriceFromTargetMargin(
      unitCost,
      expected.targetMarginPct / 100,
      4,
    );
    stage4 = {
      ...stage4,
      targetSellingPriceEtbPerKg: priced.sellingPrice,
      profitPerKgEtb: priced.marginValue,
      grossMarginPct: expected.targetMarginPct,
      totalExpectedRevenueEtb: priced.sellingPrice * qty,
    };
  }

  return { stage1, stage2, stage3, stage4 };
}
