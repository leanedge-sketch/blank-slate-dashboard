/** Single production hostname for this Vercel project. */
export const CANONICAL_PRODUCTION_HOST = "blank-slate-dashboard-plum.vercel.app";

export const CANONICAL_PRODUCTION_URL = `https://${CANONICAL_PRODUCTION_HOST}`;

/** Old deployment URLs that still resolve but must not be used. */
const LEGACY_VERCEL_HOSTS = new Set([
  "blank-slate-dashboard-gcsx.vercel.app",
  "integrated-deal-and-product-system.vercel.app",
]);

export function isLegacyProductionHost(hostname: string): boolean {
  if (LEGACY_VERCEL_HOSTS.has(hostname)) return true;
  // Other auto-aliases on the same project (e.g. *-git-main-*.vercel.app)
  if (
    hostname.endsWith(".vercel.app") &&
    hostname.startsWith("blank-slate-dashboard") &&
    hostname !== CANONICAL_PRODUCTION_HOST
  ) {
    return true;
  }
  return false;
}

export function getCanonicalRedirectUrl(): string | null {
  if (!import.meta.env.PROD || typeof window === "undefined") return null;
  const { hostname, pathname, search, hash } = window.location;
  if (!isLegacyProductionHost(hostname)) return null;
  return `${CANONICAL_PRODUCTION_URL}${pathname}${search}${hash}`;
}
