import type { ChemicalFullData, ChemicalType } from "../services/api";

export interface CatalogProductOption {
  value: string;
  label: string;
  category?: string | null;
  uuidId?: string | null;
}

/** Canonical product id for CRM/Sales links (uuid_id from PMS when available). */
export function catalogProductValue(c: ChemicalFullData): string {
  return c.uuid_id ? String(c.uuid_id) : String(c.id);
}

/** Lowercase search blob for vendor, trade name, generic name, and related fields. */
export function chemicalCatalogSearchText(c: ChemicalFullData): string {
  return [
    c.product_name,
    c.vendor,
    c.generic_name,
    c.product_category,
    c.sub_category,
    c.hs_code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function chemicalTypeOptionValue(ct: ChemicalType): string {
  const uuid = (ct.metadata as { uuid_id?: string } | null | undefined)?.uuid_id;
  return uuid ? String(uuid) : String(ct.id);
}

export function findCatalogProduct(
  ref: string,
  chemicals: ChemicalFullData[],
): ChemicalFullData | undefined {
  if (!ref) return undefined;
  return chemicals.find(
    (c) => String(c.id) === ref || (c.uuid_id != null && String(c.uuid_id) === ref),
  );
}

export function findCatalogChemicalType(
  ref: string,
  chemicalTypes: ChemicalType[],
): ChemicalType | undefined {
  if (!ref) return undefined;
  return chemicalTypes.find(
    (ct) =>
      String(ct.id) === ref ||
      (ct.metadata as { uuid_id?: string } | null | undefined)?.uuid_id === ref,
  );
}

/** Sorted CRM/Sales product dropdown options from shared catalog rows. */
export function catalogToProductOptions(
  chemicals: ChemicalFullData[],
): CatalogProductOption[] {
  return chemicals
    .filter((c) => c.product_name?.trim())
    .sort((a, b) =>
      (a.product_name || "").localeCompare(b.product_name || "", undefined, {
        sensitivity: "base",
      }),
    )
    .map((c) => ({
      value: catalogProductValue(c),
      label: [
        c.product_name,
        c.vendor ? `(${c.vendor})` : "",
        c.product_category ? `— ${c.product_category}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      category: c.product_category,
      uuidId: c.uuid_id ? String(c.uuid_id) : null,
    }));
}

export function resolveCatalogProductName(
  id: string,
  chemicals: ChemicalFullData[],
  chemicalTypes: ChemicalType[] = [],
): string {
  if (!id) return "—";
  const fromFull = findCatalogProduct(id, chemicals);
  if (fromFull?.product_name) return fromFull.product_name;
  const fromType = findCatalogChemicalType(id, chemicalTypes);
  return fromType?.name ?? "—";
}
