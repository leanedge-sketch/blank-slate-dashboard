import type { PricingRecord } from "./types";

export function formatAmount(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

export function groupRecordsByLocation(
  records: PricingRecord[],
): { location: string; records: PricingRecord[] }[] {
  const map = new Map<string, PricingRecord[]>();
  for (const record of records) {
    const loc = record.location.trim() || "Unassigned";
    const bucket = map.get(loc) ?? [];
    bucket.push(record);
    map.set(loc, bucket);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([location, rows]) => ({
      location,
      records: rows.sort((x, y) => x.incoterm.localeCompare(y.incoterm)),
    }));
}

export function newRecordId(): string {
  return `pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
