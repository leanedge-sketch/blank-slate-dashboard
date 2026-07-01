import {
  customsRatesFromConstants,
  DEFAULT_BETCHEM_CLEARANCE_ETB,
  DEFAULT_TRANSIT_INSURANCE_ETB,
  DEFAULT_TRADE_TRANSIT_INPUTS,
  type TradeTransitInputs,
} from "./tradeTransitCalc";
import { DEFAULT_FINANCE_CONSTANTS } from "./importFinanceCalc";
import { resolveWorkbookSellingInputs } from "./workbookImportAlign";

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

/** Customer / pipeline metadata rows from workbook column A labels. */
export interface WorkbookImportMetadata {
  clientName: string;
  contactPerson: string;
  requestDate: string;
  requestRef: string;
}

export interface WorkbookImportParseResult {
  scenarios: ExpectedCostScenario[];
  metadata: WorkbookImportMetadata;
}

type AnchorRule = {
  include: string[];
  exclude?: string[];
};

export type WorkbookValueField =
  | "productHeader"
  | "quantityKg"
  | "supplierBasePriceUsd"
  | "transportToMoyaleUsdPerKg"
  | "moyaleUsdPerKg"
  | "capitalParallelRate"
  | "customsOfficialRate"
  | "amountInBirr"
  | "bankChargesEtb"
  | "insuranceEtb"
  | "baseCustomsReferenceUsd"
  | "totalCustomsFeeEtb"
  | "betchemClearanceEtb"
  | "transportAddisTotalEtb"
  | "preProfitLandedBaseEtb"
  | "profitTaxEtb"
  | "totalLandedCostEtb"
  | "unitCostEtbPerKg"
  | "sellingPriceEtbPerKg"
  | "targetGrossMarginPct";

/** Dynamic label anchors — no hardcoded row indices. */
export const WORKBOOK_FIELD_ANCHORS: Record<WorkbookValueField, AnchorRule> = {
  productHeader: {
    include: [
      "discreption",
      "description",
      "product name",
      "mix chemical",
      "chemical",
      "product",
    ],
  },
  quantityKg: {
    include: ["qty in kg", "quantity kg", "quantity"],
    exclude: ["unit cost", "selling"],
  },
  supplierBasePriceUsd: {
    include: [
      "supplier base price",
      "purchasing price",
      "cost at sez /purchasing price",
      "cost at sez",
    ],
  },
  transportToMoyaleUsdPerKg: {
    include: ["transportation cost", "transport to moyale", "transport moyale"],
  },
  moyaleUsdPerKg: {
    include: ["cfca moyale cost", "cfcf moyale cost", "moyale cost"],
  },
  capitalParallelRate: {
    include: [
      "capital/parallel rate",
      "capital parallel rate",
      "parallel rate",
      "rate usd vs etb (black)",
      "rate usd vs etb (dashen black)",
      "dashen black",
      "black market rate",
    ],
    exclude: ["official"],
  },
  customsOfficialRate: {
    include: [
      "customs official rate",
      "official exchange rate",
      "rate usd vs etb (official)",
      "official rate",
    ],
    exclude: ["black", "dashen", "parallel"],
  },
  amountInBirr: {
    include: ["amount in birr", "capital outlay"],
  },
  bankChargesEtb: {
    include: ["bank charges", "bank charge"],
  },
  insuranceEtb: {
    include: ["insurance"],
    exclude: ["freight", "cif", "0.1%"],
  },
  baseCustomsReferenceUsd: {
    include: [
      "base customs reference",
      "customs reference usd",
      "customs reference",
      "customs rate",
    ],
    exclude: [
      "total customs",
      "custom duty",
      "customs fee",
      "insurance,fright",
      "insurance,freight",
    ],
  },
  totalCustomsFeeEtb: {
    include: ["total customs fee", "total customs"],
    exclude: ["reference", "rate"],
  },
  betchemClearanceEtb: {
    include: ["betchem"],
  },
  transportAddisTotalEtb: {
    include: ["transport addis", "transport addis and unloading"],
  },
  preProfitLandedBaseEtb: {
    include: [
      "total landing cost after refundaels",
      "total landing cost after refundables",
      "pre-landed base",
    ],
  },
  profitTaxEtb: {
    include: ["profit tax"],
    exclude: ["total landed"],
  },
  totalLandedCostEtb: {
    include: ["total landed cost", "total landed cost + tax"],
    exclude: ["after refund", "unit cost"],
  },
  unitCostEtbPerKg: {
    include: ["unit cost/kg", "unit cost /kg", "unit cost per kg"],
  },
  sellingPriceEtbPerKg: {
    include: ["selling roice", "selling price"],
    exclude: ["target gross margin", "gross margin target", "target margin"],
  },
  targetGrossMarginPct: {
    include: ["target gross margin", "target margin", "gross margin target"],
  },
};

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

export function normalizeWorkbookLabel(cell: string | undefined): string {
  return (cell ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

function num(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "—" || cleaned === "-") return 0;
  const direct = Number(cleaned);
  if (Number.isFinite(direct)) return direct;
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowLabel(row: string[]): string {
  return normalizeWorkbookLabel(row[0]);
}

function rowMatchesAnchor(label: string, rule: AnchorRule): boolean {
  if (rule.exclude?.some((term) => label.includes(normalizeWorkbookLabel(term)))) {
    return false;
  }
  return rule.include.some((anchor) => {
    const needle = normalizeWorkbookLabel(anchor);
    return label === needle || label.includes(needle);
  });
}

function anchorMatchScore(label: string, rule: AnchorRule): number {
  if (!rowMatchesAnchor(label, rule)) return -1;
  let best = 0;
  for (const anchor of rule.include) {
    const needle = normalizeWorkbookLabel(anchor);
    if (label === needle) best = Math.max(best, 1000 + needle.length);
    else if (label.includes(needle)) best = Math.max(best, needle.length);
  }
  return best;
}

/**
 * Scan column A for the best matching anchor row (dynamic — not row-index based).
 */
export function findAnchoredRow(
  rows: string[][],
  field: WorkbookValueField,
): string[] | undefined {
  const rule = WORKBOOK_FIELD_ANCHORS[field];

  for (const anchor of rule.include) {
    const needle = normalizeWorkbookLabel(anchor);
    const exact = rows.find((row) => rowLabel(row) === needle);
    if (exact) return exact;
  }

  let best: { row: string[]; score: number } | undefined;

  for (const row of rows) {
    const label = rowLabel(row);
    if (!label) continue;
    const score = anchorMatchScore(label, rule);
    if (score < 0) continue;
    const hasData = row.slice(1).some((cell) => num(cell) !== 0 || cell.trim().length > 0);
    const adjustedScore = hasData ? score : score - 500;
    if (!best || adjustedScore > best.score) {
      best = { row, score: adjustedScore };
    }
  }

  return best?.row;
}

export function extractAnchoredValue(
  rows: string[][],
  field: WorkbookValueField,
  col: number,
): number {
  return num(findAnchoredRow(rows, field)?.[col]);
}

function parseMarginFromLabel(label: string): number {
  const match = label.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveTargetMarginPct(
  rows: string[][],
  col: number,
): number {
  const marginRow = findAnchoredRow(rows, "targetGrossMarginPct");
  const fromCell = num(marginRow?.[col]);
  if (fromCell > 0) return fromCell;

  if (marginRow) {
    const shared = marginRow
      .slice(1)
      .map((cell) => num(cell))
      .find((value) => value > 0);
    if (shared != null && shared > 0) return shared;
  }

  const sellingRow = findAnchoredRow(rows, "sellingPriceEtbPerKg");
  if (sellingRow) {
    const fromSellingLabel = parseMarginFromLabel(sellingRow[0] ?? "");
    if (fromSellingLabel > 0) return fromSellingLabel;
  }

  for (const row of rows) {
    const label = rowLabel(row);
    if (!label.includes("margin") || !label.includes("selling")) continue;
    const fromLabel = parseMarginFromLabel(row[0] ?? "");
    if (fromLabel > 0) return fromLabel;
    const fromSellingCell = num(row[col]);
    if (fromSellingCell > 0 && fromSellingCell <= 100) return fromSellingCell;
  }

  return 0;
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

function firstNonEmpty(values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeWorkbookDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slash = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    const year =
      slash[3].length === 2 ? `20${slash[3]}` : slash[3].padStart(4, "0");
    const month = slash[1].padStart(2, "0");
    const day = slash[2].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

function metadataValueForRow(row: string[], labels: string[]): string {
  const label = row[0]?.toLowerCase().trim() ?? "";
  if (!label) return "";
  const matches = labels.some(
    (needle) => label === needle || label.includes(needle),
  );
  if (!matches) return "";
  return firstNonEmpty(row.slice(1));
}

/**
 * Read customer / contact / date / pipeline ref from labeled rows (column A).
 */
export function parseWorkbookMetadata(text: string): WorkbookImportMetadata {
  const rows = parseCsvRows(text);
  let clientName = "";
  let contactPerson = "";
  let requestDate = "";
  let requestRef = "";

  for (const row of rows) {
    clientName =
      clientName ||
      metadataValueForRow(row, [
        "customer name",
        "client name",
        "customer",
        "client",
        "buyer",
      ]);
    contactPerson =
      contactPerson ||
      metadataValueForRow(row, [
        "contact person",
        "contact name",
        "contact",
        "attn",
        "attention",
      ]);
    requestDate =
      requestDate ||
      normalizeWorkbookDate(
        metadataValueForRow(row, [
          "request date",
          "quote date",
          "pipeline date",
          "date",
        ]),
      );
    requestRef =
      requestRef ||
      metadataValueForRow(row, [
        "pipeline number",
        "pipeline no",
        "pipeline ref",
        "request number",
        "request ref",
        "request #",
        "quote ref",
        "po number",
        "po #",
        "po",
        "ref no",
      ]);
  }

  return { clientName, contactPerson, requestDate, requestRef };
}

export function parseWorkbookImport(text: string): WorkbookImportParseResult {
  return {
    scenarios: parseExpectedCostCsv(text),
    metadata: parseWorkbookMetadata(text),
  };
}

function findProductHeaderRow(rows: string[][]): string[] | undefined {
  return findAnchoredRow(rows, "productHeader");
}

/**
 * Parse workbook CSV (Expected cost / Mix chemicals) using dynamic label anchors.
 */
export function parseExpectedCostCsv(text: string): ExpectedCostScenario[] {
  const rows = parseCsvRows(text);
  const headerRow = findProductHeaderRow(rows);
  if (!headerRow) return [];

  const scenarios: ExpectedCostScenario[] = [];

  for (let col = 1; col < headerRow.length; col += 1) {
    const name = headerRow[col]?.trim();
    if (!name) continue;

    const colAt = (field: WorkbookValueField) =>
      extractAnchoredValue(rows, field, col);

    const quantityKg = colAt("quantityKg");
    const supplierBasePriceUsd = colAt("supplierBasePriceUsd");
    const transportToMoyaleUsdPerKg = colAt("transportToMoyaleUsdPerKg");
    const moyaleUsdPerKg = colAt("moyaleUsdPerKg");
    const capitalParallelRate =
      colAt("capitalParallelRate") ||
      DEFAULT_TRADE_TRANSIT_INPUTS.capitalParallelRate;
    const customsOfficialRate =
      colAt("customsOfficialRate") ||
      DEFAULT_TRADE_TRANSIT_INPUTS.customsOfficialRate;
    const amountInBirr = colAt("amountInBirr");
    const bankChargesEtb = colAt("bankChargesEtb");
    const insuranceEtb = colAt("insuranceEtb");
    const baseCustomsReferenceUsd =
      colAt("baseCustomsReferenceUsd") ||
      DEFAULT_TRADE_TRANSIT_INPUTS.baseCustomsReferenceUsd;
    const totalCustomsFeeEtb = colAt("totalCustomsFeeEtb");
    const betchemClearanceEtb = colAt("betchemClearanceEtb");
    const transportAddisTotalEtb = colAt("transportAddisTotalEtb");
    const preProfitLandedBaseEtb = colAt("preProfitLandedBaseEtb");
    const profitTaxEtb = colAt("profitTaxEtb");
    const totalLandedCostEtb = colAt("totalLandedCostEtb");
    const unitCostEtbPerKg = colAt("unitCostEtbPerKg");
    const sellingPriceEtbPerKg = colAt("sellingPriceEtbPerKg");

    if (quantityKg <= 0) continue;

    const inlandClearancePerKgEtb =
      transportAddisTotalEtb > 0 && quantityKg > 0
        ? transportAddisTotalEtb / quantityKg
        : DEFAULT_TRADE_TRANSIT_INPUTS.inlandClearancePerKgEtb;

    const bankChargePctOnCapital =
      amountInBirr > 0 && bankChargesEtb > 0
        ? bankChargesEtb / amountInBirr
        : DEFAULT_TRADE_TRANSIT_INPUTS.bankChargePctOnCapital;

    const profitTaxPctOnPreLanded =
      preProfitLandedBaseEtb > 0 && profitTaxEtb > 0
        ? profitTaxEtb / preProfitLandedBaseEtb
        : DEFAULT_TRADE_TRANSIT_INPUTS.profitTaxPctOnPreLanded;

    const explicitMarginPct = resolveTargetMarginPct(rows, col);
    const selling = resolveWorkbookSellingInputs(
      sellingPriceEtbPerKg,
      unitCostEtbPerKg,
      explicitMarginPct,
    );

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
        insuranceEtb:
          insuranceEtb > 0 ? insuranceEtb : DEFAULT_TRANSIT_INSURANCE_ETB,
        betchemClearanceEtb:
          betchemClearanceEtb > 0
            ? betchemClearanceEtb
            : DEFAULT_BETCHEM_CLEARANCE_ETB,
        profitTaxPctOnPreLanded,
        targetMarginPct: selling.targetMarginPct,
        sellingPriceMode: selling.sellingPriceMode,
        targetSellingPriceEtbPerKg: selling.targetSellingPriceEtbPerKg,
        miscBorderCosts: [],
        fixedCapitalOutlayEtb: amountInBirr > 0 ? amountInBirr : null,
      },
      expected: {
        totalCustomsFeeEtb,
        totalLandedCostEtb,
        unitCostEtbPerKg,
        sellingPriceEtbPerKg,
        targetMarginPct: selling.targetMarginPct,
      },
    });
  }

  return scenarios;
}
