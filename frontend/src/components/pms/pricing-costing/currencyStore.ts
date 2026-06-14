const STORAGE_KEY = "pricing-costing-custom-currencies-v1";

export const DEFAULT_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "ETB",
  "KES",
  "CNY",
  "AED",
  "ZAR",
] as const;

function readCustom(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c) => String(c).trim().toUpperCase())
      .filter((c) => /^[A-Z]{3,4}$/.test(c));
  } catch {
    return [];
  }
}

function writeCustom(codes: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // ignore
  }
}

export function listAllCurrencies(extra: string[] = []): string[] {
  const set = new Set<string>([...DEFAULT_CURRENCIES, ...readCustom(), ...extra]);
  return Array.from(set)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function addCustomCurrency(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{3,4}$/.test(normalized)) return null;
  const custom = readCustom();
  if (DEFAULT_CURRENCIES.includes(normalized as (typeof DEFAULT_CURRENCIES)[number])) {
    return normalized;
  }
  if (!custom.includes(normalized)) {
    writeCustom([...custom, normalized]);
  }
  return normalized;
}
