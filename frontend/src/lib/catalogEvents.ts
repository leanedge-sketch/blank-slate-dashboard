/** Fired when PMS (or any module) updates the master product catalog. */
export const CATALOG_UPDATED_EVENT = "idps-catalog-updated";

export function notifyCatalogUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT));
  }
}
