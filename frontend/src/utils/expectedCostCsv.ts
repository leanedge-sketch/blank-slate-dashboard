import {
  customsRatesFromConstants,
  DEFAULT_BETCHEM_CLEARANCE_ETB,
  DEFAULT_TRANSIT_INSURANCE_ETB,
  DEFAULT_TRADE_TRANSIT_INPUTS,
  type TradeTransitInputs,
} from "./tradeTransitCalc";
import { DEFAULT_FINANCE_CONSTANTS } from "./importFinanceCalc";

export interface ExpectedCostScenario {
  id: string;
  name: string;
  inputs: TradeTransitInputs;
  /** Reference totals from the source spreadsheet (for display / validation). */
  expected: {
    totalCustomsFeeEtb: number;
    totalLandedCostEtb: number;
    unitCostEtbPerKg: number;
    sellingPriceEtbPerKg: number;
    targetMarginPct: number;
  };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}

function num(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "—" || cleaned === "-") return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findRow(rows: string[][], labelIncludes: string): string[] | undefined {
  const needle = labelIncludes.toLowerCase();
  return rows.find((row) => row[0]?.toLowerCase().includes(needle));
}

function inferSupplierMarginPct(
  purchaseUsd: number,
  transportUsd: number,
  moyaleUsd: number,
): number {
  if (purchaseUsd <= 0) return 0;
  const implied = moyaleUsd - transportUsd;
  if (implied <= 0) return 0;
  return Math.max(0, Math.round(((implied / purchaseUsd) - 1) * 10000) / 100);
}

/**
 * Parse the legacy "Expected cost" workbook CSV (product names in columns B, C, …).
 */
export function parseExpectedCostCsv(text: string): ExpectedCostScenario[] {
  const rows = parseCsvRows(text);
  const headerRow = rows.find((r) => r[0]?.toLowerCase().includes("discreption"));
  if (!headerRow) return [];

  const scenarios: ExpectedCostScenario[] = [];

  for (let col = 1; col < headerRow.length; col += 1) {
    const name = headerRow[col]?.trim();
    if (!name) continue;

    const colAt = (label: string) => num(findRow(rows, label)?.[col]);

    const quantityKg = colAt("qty in kg");
    const supplierBasePriceUsd = colAt("purchasing price");
    const transportToMoyaleUsdPerKg = colAt("transportation cost");
    const moyaleUsdPerKg = colAt("cfca moyale cost");
    const capitalParallelRate = colAt("rate usd vs etb (black)");
    const customsOfficialRate = colAt("rate usd vs etb (official)");
    const amountInBirr = colAt("amount in birr");
    const bankChargesEtb = colAt("bank charges");
    const insuranceEtb = colAt("insurance");
    const baseCustomsReferenceUsd = colAt("customs rate");
    const totalCustomsFeeEtb = colAt("total customs fee");
    const betchemClearanceEtb = colAt("betchem");
    const transportAddisTotalEtb = colAt("transport addis");
    const preProfitLandedBaseEtb = colAt("total landing cost after refundaels");
    const profitTaxEtb = colAt("profit tax");
    const totalLandedCostEtb = colAt("total landed cost");
    const unitCostEtbPerKg = colAt("unit cost/kg");
    const sellingPriceEtbPerKg = colAt("selling roice");

    if (quantityKg <= 0) continue;

    const inlandClearancePerKgEtb =
      transportAddisTotalEtb > 0 ? transportAddisTotalEtb / quantityKg : 20;

    const bankChargePctOnCapital =
      amountInBirr > 0 ? bankChargesEtb / amountInBirr : 0.078;

    const profitTaxPctOnPreLanded =
      preProfitLandedBaseEtb > 0 ? profitTaxEtb / preProfitLandedBaseEtb : 0;

    const targetMarginPct = 15;

    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    scenarios.push({
      id,
      name,
      inputs: {
        ...DEFAULT_TRADE_TRANSIT_INPUTS,
        ...customsRatesFromConstants(DEFAULT_FINANCE_CONSTANTS),
        quantityKg,
        supplierBasePriceUsd,
        supplierMarginPct: inferSupplierMarginPct(
          supplierBasePriceUsd,
          transportToMoyaleUsdPerKg,
          moyaleUsdPerKg,
        ),
        transportToMoyaleUsdPerKg,
        capitalParallelRate,
        customsOfficialRate,
        baseCustomsReferenceUsd,
        inlandClearancePerKgEtb,
        bankChargePctOnCapital,
        insuranceEtb: insuranceEtb || DEFAULT_TRANSIT_INSURANCE_ETB,
        betchemClearanceEtb: betchemClearanceEtb || DEFAULT_BETCHEM_CLEARANCE_ETB,
        profitTaxPctOnPreLanded,
        targetMarginPct,
        sellingPriceMode: "margin",
        targetSellingPriceEtbPerKg: 0,
        miscBorderCosts: [],
        fixedCapitalOutlayEtb: amountInBirr > 0 ? amountInBirr : null,
      },
      expected: {
        totalCustomsFeeEtb,
        totalLandedCostEtb,
        unitCostEtbPerKg,
        sellingPriceEtbPerKg,
        targetMarginPct,
      },
    });
  }

  return scenarios;
}
