const REDIRECT_PATH_KEY = "redirect_path";

const AUTH_PREFIXES = ["/login", "/auth/"];

function isSafeAppPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return !AUTH_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix),
  );
}

/** Store the current location so login can restore it after sign-in. */
export function storeRedirectPath(pathname: string, search = ""): void {
  if (typeof window === "undefined") return;
  const path = `${pathname}${search || ""}`;
  if (!isSafeAppPath(path)) return;
  try {
    localStorage.setItem(REDIRECT_PATH_KEY, path);
  } catch {
    // ignore quota / private mode
  }
}

/** Read and clear `redirect_path`. Returns a safe in-app path or null. */
export function consumeRedirectPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REDIRECT_PATH_KEY);
    localStorage.removeItem(REDIRECT_PATH_KEY);
    if (!raw || !isSafeAppPath(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}
