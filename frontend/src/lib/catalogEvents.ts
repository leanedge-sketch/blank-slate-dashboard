import type { ChemicalFullData } from "../services/api";

/** Fired when PMS (or any module) updates the master product catalog. */
export const CATALOG_UPDATED_EVENT = "idps-catalog-updated";

/** Fired with the new/updated row so CRM can update lists without waiting for a full refetch. */
export const CATALOG_PRODUCT_UPSERTED_EVENT = "idps-catalog-product-upserted";

export function notifyCatalogUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT));
  }
}

export function notifyCatalogProductUpserted(product: ChemicalFullData): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CATALOG_PRODUCT_UPSERTED_EVENT, { detail: product }),
    );
  }
}
