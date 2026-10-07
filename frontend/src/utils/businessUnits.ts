export const DEFAULT_BUSINESS_UNITS = [
  "Hayat",
  "Alhadi",
  "Bet-chem",
  "Barracoda",
  "Nyumb-Chem",
  "Synresins",
] as const;

export type DefaultBusinessUnit = (typeof DEFAULT_BUSINESS_UNITS)[number];
export type BusinessUnit = string;

export function mergeBusinessUnitOptions(
  fetched: string[],
  current?: string | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...DEFAULT_BUSINESS_UNITS, ...fetched, current || ""]) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
