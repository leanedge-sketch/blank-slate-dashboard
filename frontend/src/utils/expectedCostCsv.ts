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
    capitalOutlayEtb: number;
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
      "descripion",
      "discrepion",
      "description",
      "product name",
      "mix chemical",
      "mix chemicals",
      "mix cehemicals",
      "mix cehemical",
      "chemical",
      "product",
    ],
    exclude: ["final offered price", "offered price"],
  },
  quantityKg: {
    include: ["qty in kg", "qty kg", "quantity kg", "quantity"],
    exclude: ["unit cost", "selling", "offered"],
  },
  supplierBasePriceUsd: {
    include: [
      "supplier base price",
      "purchasing price",
      "cost at sez /purchasing price",
      "cost at sez",
      "cost at sez/purchasing price",
      "cost at",
      "sez cost",
    ],
    exclude: ["moyale", "total", "landed", "customs"],
  },
  transportToMoyaleUsdPerKg: {
    include: [
      "transportation cost",
      "transport to moyale",
      "transport moyale",
      "transport to mojok",
    ],
  },
  moyaleUsdPerKg: {
    include: [
      "cfca moyale cost",
      "cfcf moyale cost",
      "moyale cost",
      "mojok cost",
      "cost at moyale",
    ],
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
      "rate us",
      "rate usd",
    ],
    exclude: ["official"],
  },
  customsOfficialRate: {
    include: [
      "customs official rate",
      "official exchange rate",
      "rate usd vs etb (official)",
      "official rate",
      "rate us",
      "rate usd",
    ],
    exclude: ["black", "dashen", "parallel"],
  },
  amountInBirr: {
    include: [
      "amount in birr",
      "amout in birr",
      "amoun",
      "capital outlay",
      "amount birr",
    ],
  },
  bankChargesEtb: {
    include: ["bank charges", "bank charge"],
  },
  insuranceEtb: {
    include: ["insurance", "insuranc"],
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
    include: [
      "total customs fee",
      "total customs",
      "total custom",
      "total cu",
    ],
    exclude: ["reference", "rate", "clearing"],
  },
  betchemClearanceEtb: {
    include: [
      "betchem",
      "belchen",
      "belchem",
      "customes clerance",
      "customs clearance",
    ],
    exclude: ["moyale", "custom clearing"],
  },
  transportAddisTotalEtb: {
    include: ["transport addis", "transport addis and unloading"],
  },
  preProfitLandedBaseEtb: {
    include: [
      "total landing cost after refundaels",
      "total landing cost after refundabels",
      "total landing cost after refundables",
      "total landed cost after refundables",
      "pre-landed base",
    ],
  },
  profitTaxEtb: {
    include: ["profit tax"],
    exclude: ["total landed"],
  },
  totalLandedCostEtb: {
    include: [
      "total landed cost",
      "total landed cost + tax",
      "total land",
      "total la",
    ],
    exclude: [
      "after refund",
      "unit cost",
      "total lan",
      "total invest",
      "total uni",
    ],
  },
  unitCostEtbPerKg: {
    include: [
      "unit cost/kg",
      "unit cost /kg",
      "unit cost per kg",
      "unit cost/kg (before vat)",
      "unit cost/kg before vat",
      "unit cos",
      "unit cost",
    ],
    exclude: ["total"],
  },
  sellingPriceEtbPerKg: {
    include: [
      "selling roice",
      "selling price",
      "sell price",
      "final sell price",
    ],
    exclude: [
      "target gross margin",
      "gross margin target",
      "target margin",
      "final offered price",
      "offered price",
    ],
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

const WORKBOOK_LABEL_TYPOS: Array<[RegExp, string]> = [
  [/discrep?tion/g, "description"],
  [/refundaels/g, "refundables"],
  [/refundabels/g, "refundables"],
  [/customes/g, "customs"],
  [/clerance/g, "clearance"],
  [/roice/g, "price"],
  [/fright/g, "freight"],
  [/belchen/g, "betchem"],
  [/belchem/g, "betchem"],
  [/cfcf/g, "cfca"],
  [/mojok/g, "moyale"],
  [/amout/g, "amount"],
  [/amoun\b/g, "amount"],
  [/insuranc\b/g, "insurance"],
  [/cehemical/g, "chemical"],
  [/descripion/g, "description"],
];

/** Normalize common workbook typos so anchors match across sheets. */
export function fuzzyWorkbookLabel(cell: string | undefined): string {
  let label = normalizeWorkbookLabel(cell);
  for (const [pattern, replacement] of WORKBOOK_LABEL_TYPOS) {
    label = label.replace(pattern, replacement);
  }
  return label;
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
  return fuzzyWorkbookLabel(row[0]);
}

/** Match full labels and truncated Excel column-A text (e.g. "total cu" → customs). */
function labelMatchesAnchor(fuzzy: string, needle: string): boolean {
  if (!fuzzy || !needle) return false;
  if (fuzzy === needle || fuzzy.includes(needle) || needle.includes(fuzzy)) {
    return true;
  }
  const fuzzyTokens = fuzzy.split(" ").filter(Boolean);
  const needleTokens = needle.split(" ").filter(Boolean);
  if (fuzzyTokens.length >= 2 && needleTokens.length >= 2) {
    if (
      fuzzyTokens[0] === needleTokens[0] &&
      (needleTokens[1]?.startsWith(fuzzyTokens[1]!) ||
        fuzzyTokens[1]?.startsWith(needleTokens[1]!))
    ) {
      return true;
    }
  }
  if (fuzzy.length >= 4 && needle.length >= 4 && needle.startsWith(fuzzy)) {
    if (fuzzyTokens.length === 1 && needleTokens.length > 1) {
      return fuzzy.length >= 6;
    }
    return true;
  }
  if (fuzzy.length >= 4 && needle.length >= 4 && fuzzy.startsWith(needle)) {
    return true;
  }
  return false;
}

function rowMatchesAnchor(label: string, rule: AnchorRule): boolean {
  const fuzzy = fuzzyWorkbookLabel(label);
  if (
    rule.exclude?.some((term) =>
      fuzzy.includes(fuzzyWorkbookLabel(term)),
    )
  ) {
    return false;
  }
  return rule.include.some((anchor) => {
    const needle = fuzzyWorkbookLabel(anchor);
    return labelMatchesAnchor(fuzzy, needle);
  });
}

function anchorMatchScore(label: string, rule: AnchorRule): number {
  if (!rowMatchesAnchor(label, rule)) return -1;
  const fuzzy = fuzzyWorkbookLabel(label);
  let best = 0;
  for (const anchor of rule.include) {
    const needle = fuzzyWorkbookLabel(anchor);
    if (fuzzy === needle) best = Math.max(best, 1000 + needle.length);
    else if (labelMatchesAnchor(fuzzy, needle)) {
      best = Math.max(best, Math.min(fuzzy.length, needle.length));
    }
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
    const needle = fuzzyWorkbookLabel(anchor);
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

/**
 * When several rows share a truncated label (e.g. two "Rate US" rows),
 * pick parallel (black) = higher rate and official = lower rate.
 */
function extractWorkbookExchangeRates(
  rows: string[][],
  col: number,
): { capitalParallelRate: number; customsOfficialRate: number } {
  const parallel = extractAnchoredValue(rows, "capitalParallelRate", col);
  const official = extractAnchoredValue(rows, "customsOfficialRate", col);
  if (parallel > 0 && official > 0 && parallel !== official) {
    return { capitalParallelRate: parallel, customsOfficialRate: official };
  }

  const rateRows = rows.filter((row) => {
    const label = rowLabel(row);
    return (
      label.startsWith("rate us") ||
      label.startsWith("rate usd") ||
      label.includes("rate usd vs etb")
    );
  });

  const values = rateRows
    .map((row) => num(row[col]))
    .filter((value) => value >= 100 && value <= 250);

  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length >= 2) {
    return {
      capitalParallelRate: unique[0]!,
      customsOfficialRate: unique[unique.length - 1]!,
    };
  }
  if (unique.length === 1) {
    return {
      capitalParallelRate: unique[0]!,
      customsOfficialRate: official > 0 ? official : unique[0]!,
    };
  }

  return {
    capitalParallelRate:
      parallel || DEFAULT_TRADE_TRANSIT_INPUTS.capitalParallelRate,
    customsOfficialRate:
      official || DEFAULT_TRADE_TRANSIT_INPUTS.customsOfficialRate,
  };
}

const MAX_PLAUSIBLE_UNIT_COST_ETB_PER_KG = 50_000;

/**
 * Prefer explicit Unit Cos/kg rows; fall back to Total uni (ETB total) ÷ qty.
 * Reject totals mistaken for per-kg (values > 50k ETB).
 */
function extractWorkbookUnitCostEtbPerKg(
  rows: string[][],
  col: number,
  quantityKg: number,
): number {
  const rule = WORKBOOK_FIELD_ANCHORS.unitCostEtbPerKg;
  let best: { value: number; score: number } | undefined;

  for (const row of rows) {
    const label = rowLabel(row);
    if (!rowMatchesAnchor(label, rule)) continue;
    const value = num(row[col]);
    if (value <= 0) continue;

    let perKg = value;
    if (value > MAX_PLAUSIBLE_UNIT_COST_ETB_PER_KG && quantityKg > 0) {
      perKg = value / quantityKg;
    }
    if (perKg <= 0 || perKg > MAX_PLAUSIBLE_UNIT_COST_ETB_PER_KG) continue;

    const score = anchorMatchScore(label, rule);
    if (!best || score > best.score) {
      best = { value: perKg, score };
    }
  }

  if (best) return best.value;

  for (const row of rows) {
    const label = rowLabel(row);
    if (!label.startsWith("total uni") && !label.startsWith("total unit")) {
      continue;
    }
    const total = num(row[col]);
    if (total > 0 && quantityKg > 0) {
      return total / quantityKg;
    }
  }

  return 0;
}

/** Pick final landed total — skip intermediate Total lan / investment subtotals. */
function extractWorkbookTotalLandedCostEtb(
  rows: string[][],
  col: number,
  quantityKg: number,
  unitCostEtbPerKg: number,
): number {
  const rule = WORKBOOK_FIELD_ANCHORS.totalLandedCostEtb;
  let best: { value: number; score: number } | undefined;

  for (const row of rows) {
    const label = rowLabel(row);
    if (!rowMatchesAnchor(label, rule)) continue;
    if (label.startsWith("total lan") && !label.includes("landed")) continue;

    const value = num(row[col]);
    if (value <= 0) continue;

    let score = anchorMatchScore(label, rule);
    if (label === "total la" || label.startsWith("total landed cost")) {
      score += 500;
    }

    if (!best || score > best.score) {
      best = { value, score };
    }
  }

  if (best) return best.value;
  if (unitCostEtbPerKg > 0 && quantityKg > 0) {
    return unitCostEtbPerKg * quantityKg;
  }
  return 0;
}

/** Selling price from labeled row, or trailing unlabeled numeric rows after unit cost. */
function extractWorkbookSellingPriceEtbPerKg(
  rows: string[][],
  col: number,
  unitCostEtbPerKg: number,
): number {
  const labeled = extractAnchoredValue(rows, "sellingPriceEtbPerKg", col);
  if (labeled > 0) return labeled;

  const unitRowIndex = rows.findIndex((row) => {
    const label = rowLabel(row);
    return (
      rowMatchesAnchor(label, WORKBOOK_FIELD_ANCHORS.unitCostEtbPerKg) ||
      label.startsWith("total uni")
    );
  });

  const searchFrom = unitRowIndex >= 0 ? unitRowIndex + 1 : 0;
  let bestCandidate = 0;

  for (const row of rows.slice(searchFrom)) {
    const label = rowLabel(row[0]);
    const value = num(row[col]);
    if (value <= 0) continue;

    const isSellingLabel = rowMatchesAnchor(
      label,
      WORKBOOK_FIELD_ANCHORS.sellingPriceEtbPerKg,
    );
    if (!label || isSellingLabel) {
      if (unitCostEtbPerKg > 0 && value >= unitCostEtbPerKg) {
        bestCandidate = value;
      } else if (!label && value > bestCandidate) {
        bestCandidate = value;
      }
    }
  }

  return bestCandidate;
}

function parseMarginFromLabel(label: string): number {
  const match = label.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Read duty / WHT / VAT % from labeled customs rows (e.g. "WHT (2%)"). */
function inferWorkbookTaxRates(
  rows: string[][],
): Partial<
  Pick<
    TradeTransitInputs,
    | "customsDutyPct"
    | "scanFeePct"
    | "socialFeePct"
    | "whtPct"
    | "vatPct"
  >
> {
  const rates: Partial<
    Pick<
      TradeTransitInputs,
      | "customsDutyPct"
      | "scanFeePct"
      | "socialFeePct"
      | "whtPct"
      | "vatPct"
    >
  > = {};

  for (const row of rows) {
    const label = rowLabel(row);
    if (!label) continue;
    if (label.includes("refund") || label.includes("refundable")) continue;
    const pctLabel = parseMarginFromLabel(row[0] ?? label);
    if (pctLabel <= 0) continue;

    if (
      (label.includes("custom duty") || label.includes("customs duty")) &&
      rates.customsDutyPct == null
    ) {
      rates.customsDutyPct = pctLabel / 100;
      continue;
    }
    if (label.includes("scan fee") && rates.scanFeePct == null) {
      rates.scanFeePct = pctLabel < 1 ? pctLabel / 10 : pctLabel / 100;
      continue;
    }
    if (label.includes("social fee") && rates.socialFeePct == null) {
      rates.socialFeePct = pctLabel / 100;
      continue;
    }
    if (label.includes("wht") && rates.whtPct == null) {
      rates.whtPct = pctLabel / 100;
      continue;
    }
    if (label.includes("vat") && rates.vatPct == null) {
      rates.vatPct = pctLabel / 100;
    }
  }

  return rates;
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
  const anchored = findAnchoredRow(rows, "productHeader");
  if (anchored) return anchored;

  for (const row of rows.slice(0, 8)) {
    const label = rowLabel(row[0]);
    const productNames = row
      .slice(1)
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 1 && num(cell) === 0);
    if (productNames.length === 0) continue;

    const looksLikeHeader =
      !label ||
      label.includes("chemical") ||
      label.includes("product") ||
      label.includes("description");
    const qtyRow = findAnchoredRow(rows, "quantityKg");
    if (looksLikeHeader && qtyRow) {
      return row;
    }
  }

  return undefined;
}

/**
 * Parse workbook CSV (Expected cost / Mix chemicals) using dynamic label anchors.
 */
export function parseExpectedCostCsv(text: string): ExpectedCostScenario[] {
  const rows = parseCsvRows(text);
  const headerRow = findProductHeaderRow(rows);
  if (!headerRow) return [];

  const workbookTaxRates = inferWorkbookTaxRates(rows);
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
    const { capitalParallelRate, customsOfficialRate } =
      extractWorkbookExchangeRates(rows, col);
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
    const unitCostEtbPerKg = extractWorkbookUnitCostEtbPerKg(rows, col, quantityKg);
    const totalLandedCostEtb = extractWorkbookTotalLandedCostEtb(
      rows,
      col,
      quantityKg,
      unitCostEtbPerKg,
    );
    const sellingPriceEtbPerKg = extractWorkbookSellingPriceEtbPerKg(
      rows,
      col,
      unitCostEtbPerKg,
    );

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
        ...workbookTaxRates,
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
        workbookTotalCustomsFeeEtb:
          totalCustomsFeeEtb > 0 ? totalCustomsFeeEtb : null,
        workbookNetLandedCostEtb:
          totalLandedCostEtb > 0 ? totalLandedCostEtb : null,
        workbookUnitCostEtbPerKg:
          unitCostEtbPerKg > 0 ? unitCostEtbPerKg : null,
      },
      expected: {
        capitalOutlayEtb: amountInBirr,
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
