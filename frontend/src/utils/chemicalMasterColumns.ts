import type { ChemicalFullData } from "../services/api";

/** Fixed PMS sector options for master data create/edit and filters. */
export const PMS_SECTOR_OPTIONS = [
  "Construction",
  "Paint and Coating",
  "Personal and Cleaning",
  "Plastic and Foam",
  "Food and Pharmaceutical",
] as const;

export type ChemicalMasterColumn = {
  key: keyof ChemicalFullData | "actions";
  label: string;
  /** Table cell formatter */
  format?: (row: ChemicalFullData) => string;
};

export const CHEMICAL_MASTER_COLUMNS: ChemicalMasterColumn[] = [
  { key: "id", label: "ID" },
  { key: "sector", label: "Sector" },
  { key: "industry", label: "Industry" },
  { key: "vendor", label: "Supplier" },
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
];

export function chemicalCellValue(
  row: ChemicalFullData,
  key: ChemicalMasterColumn["key"],
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
  { key: "sector", label: "Sector" },
  { key: "industry", label: "Industry" },
  { key: "vendor", label: "Supplier / Vendor" },
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
