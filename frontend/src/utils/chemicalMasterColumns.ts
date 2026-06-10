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
  | "actions";

export type ChemicalMasterColumn = {
  key: ChemicalMasterColumnKey;
  label: string;
  /** Table cell formatter */
  format?: (row: ChemicalFullData) => string;
};

export const CHEMICAL_MASTER_COLUMNS: ChemicalMasterColumn[] = [
  { key: "id", label: "ID" },
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
    key: "price",
    label: "Price",
    format: (r) =>
      r.price != null && r.price !== undefined ? String(r.price) : "—",
  },
  { key: "typical_application", label: "Typical Application" },
  { key: "product_description", label: "Description" },
  { key: "tds_document", label: "TDS Document", format: () => "—" },
  { key: "tds_brand", label: "TDS Brand", format: () => "—" },
  { key: "tds_grade", label: "TDS Grade", format: () => "—" },
];

export function chemicalCellValue(
  row: ChemicalFullData,
  key: ChemicalMasterColumnKey,
): string {
  if (key === "actions") return "";
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
  { key: "sub_category", label: "Sub Category" },
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
