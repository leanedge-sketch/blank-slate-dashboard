import type { ChemicalFullData, ChemicalFullDataCreate } from "../services/api";
import type { MasterDataProductSuggestion } from "../services/api";

/** Fixed PMS sector options for master data create/edit and filters. */
export const PMS_SECTOR_OPTIONS = [
  "Construction",
  "Paint and Coating",
  "Personal and Cleaning",
  "Plastic and Foam",
  "Food and Pharmaceutical",
] as const;

/** Fixed industry dropdown for Chemical Master Data. */
export const PMS_INDUSTRY_OPTIONS = [
  "Dry Mix mortar",
  "Concrete admixture",
  "Paint and Coating",
  "Plastic",
  "Foam",
  "Detergent",
  "Food",
  "Pharmaceutical",
] as const;

export type ChemicalMasterColumnKey =
  | keyof ChemicalFullData
  | "tds_document"
  | "line_no"
  | "actions";

export type ChemicalMasterColumn = {
  key: ChemicalMasterColumnKey;
  label: string;
  /** Right-align header and cells (line #, ref, price). */
  numeric?: boolean;
  /** Table cell formatter */
  format?: (row: ChemicalFullData) => string;
};

function formatMoneyAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null || amount === undefined) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return currency?.trim() ? `${formatted} ${currency.trim()}` : formatted;
}

function formatCurrentPrice(row: ChemicalFullData): string {
  return formatMoneyAmount(row.current_price, row.current_price_currency);
}

function formatTdsDocument(row: ChemicalFullData): string {
  if (!row.tds_document?.trim()) return "—";
  return "View document";
}

export const CHEMICAL_MASTER_COLUMNS: ChemicalMasterColumn[] = [
  { key: "line_no", label: "#", numeric: true },
  { key: "id", label: "Ref", numeric: true },
  { key: "vendor", label: "Supplier" },
  { key: "sector", label: "Sector" },
  { key: "industry", label: "Industry" },
  { key: "product_category", label: "Category" },
  { key: "sub_category", label: "Sub Category" },
  { key: "product_name", label: "Product Name" },
  { key: "generic_name", label: "Generic Name" },
  { key: "product_type", label: "Product Type" },
  { key: "packing", label: "Packaging" },
  { key: "hs_code", label: "HS Code" },
  { key: "country_of_origin", label: "Country of Origin" },
  {
    key: "current_price",
    label: "Current price",
    numeric: true,
    format: formatCurrentPrice,
  },
  { key: "tds_document", label: "TDS Document", format: formatTdsDocument },
  { key: "typical_application", label: "Typical Application" },
  { key: "product_description", label: "Description" },
];

/** Columns users can click to edit inline (read-only: #, ref, synced price, TDS). */
export const CHEMICAL_EDITABLE_COLUMN_KEYS = new Set<ChemicalMasterColumnKey>([
  "vendor",
  "sector",
  "industry",
  "product_category",
  "sub_category",
  "product_name",
  "generic_name",
  "product_type",
  "packing",
  "hs_code",
  "country_of_origin",
  "typical_application",
  "product_description",
]);

export function isChemicalColumnEditable(key: ChemicalMasterColumnKey): boolean {
  return CHEMICAL_EDITABLE_COLUMN_KEYS.has(key);
}

export function chemicalMasterHeaderClass(col: ChemicalMasterColumn): string {
  const base =
    "px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap";
  return col.numeric ? `${base} text-right tabular-nums` : `${base} text-left`;
}

export function chemicalMasterCellClass(col: ChemicalMasterColumn): string {
  const base = "px-4 py-3 text-sm text-slate-700 max-w-[220px] truncate";
  if (col.key === "id") {
    return `${base} text-right tabular-nums text-slate-500 font-mono text-xs`;
  }
  if (col.key === "line_no") {
    return `${base} text-right tabular-nums text-slate-900 font-medium w-12`;
  }
  if (col.numeric) {
    return `${base} text-right tabular-nums`;
  }
  return base;
}

export function chemicalCellValue(
  row: ChemicalFullData,
  key: ChemicalMasterColumnKey,
  lineNo?: number,
): string {
  if (key === "actions") return "";
  if (key === "line_no") {
    return lineNo != null ? String(lineNo) : "—";
  }
  const col = CHEMICAL_MASTER_COLUMNS.find((c) => c.key === key);
  if (col?.format) return col.format(row);
  if (key === "tds_document") return formatTdsDocument(row);
  const val = row[key as keyof ChemicalFullData];
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

export const CHEMICAL_MASTER_FORM_FIELDS: Array<{
  key: keyof ChemicalFullData;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "textarea";
}> = [
  { key: "vendor", label: "Supplier / Vendor" },
  { key: "sector", label: "Sector" },
  { key: "industry", label: "Industry" },
  { key: "product_category", label: "Product Category" },
  { key: "sub_category", label: "Sub Category" },
  { key: "product_name", label: "Product Name", required: true },
  { key: "generic_name", label: "Generic Name" },
  { key: "product_type", label: "Product Type" },
  { key: "packing", label: "Packaging" },
  { key: "hs_code", label: "HS Code" },
  { key: "country_of_origin", label: "Country of Origin" },
  { key: "typical_application", label: "Typical Application", type: "textarea" },
  { key: "product_description", label: "Product Description", type: "textarea" },
];

/** Sort master-data rows by supplier, then product name (stable tie-breaker on id). */
export function sortChemicalsBySupplier(
  rows: ChemicalFullData[],
): ChemicalFullData[] {
  return [...rows].sort((a, b) => {
    const supplierA = (a.vendor || "").trim().toLowerCase();
    const supplierB = (b.vendor || "").trim().toLowerCase();
    if (supplierA !== supplierB) {
      return supplierA.localeCompare(supplierB);
    }
    const nameA = (a.product_name || "").trim().toLowerCase();
    const nameB = (b.product_name || "").trim().toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

/** Map master-data search suggestion into create-form fields. */
export function masterSuggestionToChemicalForm(
  suggestion: MasterDataProductSuggestion,
): Partial<ChemicalFullDataCreate> {
  const industry =
    suggestion.industry &&
    PMS_INDUSTRY_OPTIONS.includes(
      suggestion.industry as (typeof PMS_INDUSTRY_OPTIONS)[number],
    )
      ? suggestion.industry
      : suggestion.product_type &&
          PMS_INDUSTRY_OPTIONS.includes(
            suggestion.product_type as (typeof PMS_INDUSTRY_OPTIONS)[number],
          )
        ? suggestion.product_type
        : suggestion.industry || null;
  return {
    sector: suggestion.sector || null,
    vendor: suggestion.vendor || null,
    product_category: suggestion.product_category || null,
    sub_category: suggestion.sub_category || null,
    product_name: suggestion.product_name || null,
    generic_name: suggestion.generic_name || null,
    product_type: suggestion.product_type || null,
    industry,
    packing: suggestion.packing || null,
    hs_code: suggestion.hs_code || null,
    country_of_origin: suggestion.country_of_origin || null,
  };
}

export function formDataToCreatePayload(
  form: ChemicalFullDataCreate & { id?: number },
): ChemicalFullDataCreate {
  const text = (v: string | null | undefined) => {
    const t = (v ?? "").trim();
    return t || null;
  };
  return {
    sector: text(form.sector),
    industry: text(form.industry),
    partner_id: form.partner_id || null,
    vendor: text(form.vendor),
    product_category: text(form.product_category),
    sub_category: text(form.sub_category),
    product_name: text(form.product_name),
    generic_name: text(form.generic_name),
    product_type: text(form.product_type),
    packing: text(form.packing),
    hs_code: text(form.hs_code),
    country_of_origin: text(form.country_of_origin),
    typical_application: text(form.typical_application),
    product_description: text(form.product_description),
  };
}

export function chemicalSearchPrimaryLabel(row: ChemicalFullData): string {
  return row.product_name || row.generic_name || "Unnamed";
}

export function chemicalSearchSecondaryLabel(row: ChemicalFullData): string {
  return [
    row.generic_name && row.generic_name !== row.product_name ? row.generic_name : null,
    row.vendor,
    row.hs_code,
    row.sub_category,
    row.product_category,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Merge a freshly loaded row into a list (keeps sort order stable). */
export function mergeChemicalIntoList(
  rows: ChemicalFullData[],
  full: ChemicalFullData,
): ChemicalFullData[] {
  const next = rows.some((c) => c.id === full.id)
    ? rows.map((c) => (c.id === full.id ? full : c))
    : [full, ...rows];
  return sortChemicalsBySupplier(next);
}

