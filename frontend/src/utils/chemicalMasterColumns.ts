import type { ChemicalFullData } from "../services/api";

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

/** Placeholder TDS columns — reserved for future TDS links; always empty for now. */
export const CHEMICAL_MASTER_TDS_PLACEHOLDER_KEYS = [
  "tds_document",
  "tds_brand",
  "tds_grade",
] as const;

export type ChemicalMasterColumnKey =
  | keyof ChemicalFullData
  | (typeof CHEMICAL_MASTER_TDS_PLACEHOLDER_KEYS)[number]
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

function formatPrice(row: ChemicalFullData): string {
  if (row.price == null || row.price === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(row.price);
}

export const CHEMICAL_MASTER_COLUMNS: ChemicalMasterColumn[] = [
  { key: "line_no", label: "#", numeric: true },
  { key: "id", label: "Ref", numeric: true },
  { key: "vendor", label: "Supplier" },
  { key: "sector", label: "Sector" },
  { key: "industry", label: "Industry" },
  { key: "product_category", label: "Category" },
  { key: "product_name", label: "Product Name" },
  { key: "generic_name", label: "Generic Name" },
  { key: "product_type", label: "Product Type" },
  { key: "packing", label: "Packaging" },
  { key: "hs_code", label: "HS Code" },
  { key: "country_of_origin", label: "Country of Origin" },
  { key: "price", label: "Price", numeric: true, format: formatPrice },
  { key: "typical_application", label: "Typical Application" },
  { key: "product_description", label: "Description" },
  { key: "tds_document", label: "TDS Document", format: () => "—" },
  { key: "tds_brand", label: "TDS Brand", format: () => "—" },
  { key: "tds_grade", label: "TDS Grade", format: () => "—" },
];

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
  { key: "product_name", label: "Product Name", required: true },
  { key: "generic_name", label: "Generic Name" },
  { key: "product_type", label: "Product Type" },
  { key: "packing", label: "Packaging" },
  { key: "hs_code", label: "HS Code" },
  { key: "country_of_origin", label: "Country of Origin" },
  { key: "price", label: "Price", type: "number" },
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
