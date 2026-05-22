import type { StrategicFitItem } from "./profileText";

/** Normalize a category string for lookup in correctionMap. */
export function normalizeCategoryKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps messy DB / AI labels to a single canonical UI label.
 * Keys are normalized via normalizeCategoryKey.
 */
export const correctionMap: Record<string, string> = {
  additive: "Additives",
  additve: "Additives",
  additex: "Additives",
  additives: "Additives",
  admixture: "Admixtures",
  admixtures: "Admixtures",
  cement: "Cement",
  cements: "Cement",
  "dry mix": "Dry-Mix",
  drymix: "Dry-Mix",
  "dry-mix": "Dry-Mix",
  "dry mortar": "Dry-Mix",
  pigment: "Pigments",
  pigments: "Pigments",
  "paint coatings": "Paint & Coatings",
  "paint and coatings": "Paint & Coatings",
  "paint & coatings": "Paint & Coatings",
  coatings: "Paint & Coatings",
  "paint coating": "Paint & Coatings",
  plaster: "Plaster",
  plasters: "Plaster",
  "grinding aid": "Cement Grinding Aids",
  "grinding aids": "Cement Grinding Aids",
  "cement grinding": "Cement Grinding Aids",
  "cement grinding aids": "Cement Grinding Aids",
  waterproofing: "Waterproofing",
  fiber: "Fibers",
  fibers: "Fibers",
  fibre: "Fibers",
  fibres: "Fibers",
  plasticizer: "Plasticizers",
  plasticizers: "Plasticizers",
  defoamer: "Defoamers",
  defoamers: "Defoamers",
  binder: "Binders",
  binders: "Binders",
  polymer: "Polymers",
  polymers: "Polymers",
};

const CORRECTION_KEYS = Object.keys(correctionMap);

/** Resolve a raw DB category to the canonical UI label. */
export function canonicalStrategicFitLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const key = normalizeCategoryKey(trimmed);
  if (correctionMap[key]) {
    return correctionMap[key];
  }

  const fuzzy = findClosestCorrectionKey(key);
  if (fuzzy) {
    return correctionMap[fuzzy];
  }

  return trimmed;
}

function findClosestCorrectionKey(key: string): string | null {
  if (key.length < 4) return null;

  let best: string | null = null;
  let bestDist = 3;

  for (const candidate of CORRECTION_KEYS) {
    if (Math.abs(candidate.length - key.length) > 2) continue;
    const dist = levenshtein(key, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

interface MergeGroup {
  label: string;
  score: number;
  entries: { sourceCategory: string; reason: string }[];
}

function buildMergedReason(
  label: string,
  entries: { sourceCategory: string; reason: string }[],
): string {
  const withReason = entries
    .map((e) => ({
      source: e.sourceCategory.trim(),
      reason: e.reason.trim(),
    }))
    .filter((e) => e.reason);

  if (!withReason.length) return "";

  const sourceLabels = [...new Set(withReason.map((e) => e.source))];
  const multipleSources =
    sourceLabels.length > 1 ||
    sourceLabels.some((s) => normalizeCategoryKey(s) !== normalizeCategoryKey(label));

  if (!multipleSources) {
    const unique = [...new Set(withReason.map((e) => e.reason))];
    return unique.join(" ");
  }

  return withReason
    .map((e) =>
      normalizeCategoryKey(e.source) === normalizeCategoryKey(label)
        ? e.reason
        : `${e.source}: ${e.reason}`,
    )
    .filter((line, idx, arr) => arr.indexOf(line) === idx)
    .join(" · ");
}

/**
 * Group assessment rows by corrected label; keep max score and all rationale text.
 */
export function mergeStrategicFitAssessmentItems(
  items: StrategicFitItem[],
): StrategicFitItem[] {
  const groups = new Map<string, MergeGroup>();

  for (const item of items) {
    const label = canonicalStrategicFitLabel(item.category);
    const groupKey = normalizeCategoryKey(label);
    const score = Math.min(3, Math.max(0, Number(item.score) || 0));
    const existing = groups.get(groupKey);

    if (!existing) {
      groups.set(groupKey, {
        label,
        score,
        entries: [
          {
            sourceCategory: item.category,
            reason: item.reason || "",
          },
        ],
      });
      continue;
    }

    existing.score = Math.max(existing.score, score);
    existing.entries.push({
      sourceCategory: item.category,
      reason: item.reason || "",
    });
  }

  return Array.from(groups.values()).map((group) => ({
    category: group.label,
    score: group.score,
    reason: buildMergedReason(group.label, group.entries),
  }));
}

export interface StrategicFitVisibilitySplit {
  visible: StrategicFitItem[];
  hidden: StrategicFitItem[];
}

/**
 * Sort by score descending; apply show-all-positive, min-3-visible, overflow rules.
 */
export function splitStrategicFitVisibility(
  items: StrategicFitItem[],
): StrategicFitVisibilitySplit {
  const sorted = [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.category.localeCompare(b.category);
  });

  const positive = sorted.filter((i) => i.score > 0);
  const zero = sorted.filter((i) => i.score === 0);

  if (positive.length >= 3) {
    return { visible: positive, hidden: zero };
  }

  const needFromZero = Math.max(0, 3 - positive.length);
  const visible = [...positive, ...zero.slice(0, needFromZero)];
  const hidden = zero.slice(needFromZero);

  return { visible, hidden };
}
