import type { LeanChemRecommendedProduct } from "../services/api";
import { PMS_SECTOR_OPTIONS } from "./chemicalMasterColumns";

export { PMS_SECTOR_OPTIONS };

export type LeanChemProductColumn = {
  key: keyof LeanChemRecommendedProduct | "actions";
  label: string;
  format?: (row: LeanChemRecommendedProduct) => string;
};

export const LEAN_CHEM_PRODUCT_COLUMNS: LeanChemProductColumn[] = [
  { key: "id", label: "ID" },
  { key: "sector", label: "Sector" },
  { key: "vendor", label: "Supplier" },
  { key: "product_category", label: "Category" },
  { key: "sub_category", label: "Sub Category" },
  { key: "product_name", label: "Product Name" },
  { key: "generic_name", label: "Generic Name" },
  { key: "product_type", label: "Product Type" },
  { key: "packing", label: "Packaging" },
  { key: "hs_code", label: "HS Code" },
  { key: "country_of_origin", label: "Country of Origin" },
  { key: "source_master_row_no", label: "Master Ref" },
  { key: "recommendation_notes", label: "Why Recommend" },
];

export function leanChemCellValue(
  row: LeanChemRecommendedProduct,
  key: LeanChemProductColumn["key"],
): string {
  if (key === "actions") return "";
  const col = LEAN_CHEM_PRODUCT_COLUMNS.find((c) => c.key === key);
  if (col?.format) return col.format(row);
  const val = row[key as keyof LeanChemRecommendedProduct];
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

export type MasterDataSuggestion = {
  master_row_no?: number | null;
  product_name?: string | null;
  generic_name?: string | null;
  product_type?: string | null;
  sector?: string | null;
  vendor?: string | null;
  product_category?: string | null;
  sub_category?: string | null;
  packing?: string | null;
  hs_code?: string | null;
  country_of_origin?: string | null;
  match_label?: string | null;
};

export function suggestionToForm(
  suggestion: MasterDataSuggestion,
): Partial<LeanChemRecommendedProduct> {
  return {
    sector: suggestion.sector || "",
    vendor: suggestion.vendor || "",
    product_category: suggestion.product_category || "",
    sub_category: suggestion.sub_category || "",
    product_name: suggestion.product_name || "",
    generic_name: suggestion.generic_name || "",
    product_type: suggestion.product_type || "",
    industry: suggestion.product_type || "",
    packing: suggestion.packing || "",
    hs_code: suggestion.hs_code || "",
    country_of_origin: suggestion.country_of_origin || "",
    source_master_row_no: suggestion.master_row_no ?? null,
    recommendation_notes: "Suggested from Chemical Master Data",
  };
}
