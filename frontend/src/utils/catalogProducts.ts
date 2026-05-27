import type { ChemicalFullData, ChemicalType } from "../services/api";

export interface CatalogProductOption {
  value: string;
  label: string;
  category?: string | null;
  uuidId?: string | null;
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
      value: String(c.id),
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
  const fromFull = chemicals.find(
    (c) => String(c.id) === id || (c.uuid_id && String(c.uuid_id) === id),
  );
  if (fromFull?.product_name) return fromFull.product_name;
  const fromType = chemicalTypes.find(
    (c) => String(c.id) === id || c.metadata?.uuid_id === id,
  );
  return fromType?.name ?? "—";
}
