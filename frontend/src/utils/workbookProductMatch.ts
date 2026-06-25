import type { ChemicalFullData } from "../services/api";
import {
  catalogProductValue,
  chemicalCatalogSearchText,
  findCatalogProduct,
} from "./catalogProducts";

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

export function scoreProductMatch(
  query: string,
  chemical: ChemicalFullData,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = (chemical.product_name || "").trim().toLowerCase();
  if (!name) return 0;
  if (name === q) return 100;
  if (name.includes(q) || q.includes(name)) return 82;

  const qTokens = tokenize(q);
  if (qTokens.length === 0) return 0;

  const hay = chemicalCatalogSearchText(chemical);
  let hits = 0;
  for (const token of qTokens) {
    if (hay.includes(token)) hits += 1;
  }
  if (hits === 0) return 0;

  const coverage = hits / qTokens.length;
  const vendorBoost =
    chemical.vendor && q.includes(chemical.vendor.toLowerCase()) ? 8 : 0;
  return Math.min(78, Math.round(coverage * 70 + vendorBoost));
}

export function suggestCatalogProducts(
  query: string,
  chemicals: ChemicalFullData[],
  limit = 6,
): Array<{ chemical: ChemicalFullData; score: number }> {
  const seen = new Set<string>();
  const ranked: Array<{ chemical: ChemicalFullData; score: number }> = [];

  for (const chemical of chemicals) {
    const key = catalogProductValue(chemical);
    if (seen.has(key)) continue;
    const score = scoreProductMatch(query, chemical);
    if (score <= 0) continue;
    seen.add(key);
    ranked.push({ chemical, score });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function bestCatalogMatch(
  query: string,
  chemicals: ChemicalFullData[],
  minScore = 55,
): ChemicalFullData | null {
  const top = suggestCatalogProducts(query, chemicals, 1)[0];
  return top && top.score >= minScore ? top.chemical : null;
}

export function resolveLinkedCatalogName(
  chemicalTypeId: string | null,
  chemicals: ChemicalFullData[],
  fallback = "",
): string {
  if (!chemicalTypeId) return fallback;
  return findCatalogProduct(chemicalTypeId, chemicals)?.product_name || fallback;
}
