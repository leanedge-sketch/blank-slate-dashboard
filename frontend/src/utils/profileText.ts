export interface StrategicFitItem {
  category: string;
  score: number;
  reason: string;
}

const FIT_LINE_RE =
  /^-?\s*(.+?):\s*(\d)\s*\/\s*3\s*(?:[-–—]\s*)?(.*)$/i;

const FIT_HEADER_RE =
  /^(strategic[- ]?fit(\s+assessment|\s+matrix)?|score\s+rationale)$/i;

const FIT_SECTION_TITLE_RE =
  /^\d*\.?\s*strategic[- ]?fit(\s+assessment|\s+matrix)?\s*$/i;

/**
 * Parse lines like "Cement: 0/3 - No manufacturing presence in Ethiopia"
 */
export function parseStrategicFitLines(text: string): StrategicFitItem[] {
  const items: StrategicFitItem[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(FIT_LINE_RE);
    if (!match) continue;
    const score = Math.min(3, Math.max(0, parseInt(match[2], 10)));
    items.push({
      category: match[1].trim().replace(/^[-•]\s*/, ""),
      score,
      reason: (match[3] || "").trim(),
    });
  }
  return items;
}

/**
 * Prefer DB scores; attach rationale text parsed from the profile body.
 */
export function mergeStrategicFitItems(
  scores: Record<string, number> | null | undefined,
  profileText: string,
): StrategicFitItem[] {
  const reasonByKey = new Map<string, string>();
  for (const item of parseStrategicFitLines(profileText)) {
    reasonByKey.set(item.category.toLowerCase().trim(), item.reason);
  }

  if (scores && Object.keys(scores).length > 0) {
    return Object.entries(scores).map(([category, rawScore]) => {
      const score = Math.min(3, Math.max(0, Number(rawScore) || 0));
      const key = category.toLowerCase().trim();
      return {
        category,
        score,
        reason: reasonByKey.get(key) || "",
      };
    });
  }

  return parseStrategicFitLines(profileText);
}

/** Remove fit-score lines and matrix headings from prose (shown in score cards instead). */
export function stripStrategicFitLinesFromProfile(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (FIT_LINE_RE.test(t)) return false;
      if (FIT_HEADER_RE.test(t)) return false;
      if (FIT_SECTION_TITLE_RE.test(t)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Strip broken markdown from saved ICP profiles so the UI shows bullets and numbers.
 */
export function stripProfileMarkdown(text: string): string {
  if (!text?.trim()) return "";

  let out = text
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[\s\S]*"strategic_fit_matrix"[\s\S]*\}/gi, "");

  const lines = out.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) {
      cleaned.push("");
      continue;
    }
    if (isTableSeparatorLine(stripped)) continue;
    if (isTableRow(stripped)) {
      const plain = tableRowToPlain(stripped);
      if (plain) cleaned.push(plain);
      continue;
    }
    const heading = stripped.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      cleaned.push("");
      cleaned.push(heading[1].trim());
      cleaned.push("");
      continue;
    }
    cleaned.push(line);
  }

  out = cleaned.join("\n");
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/\*([^*]+)\*/g, "$1");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  out = out.replace(/\[\d+\]/g, "");
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}

function isTableSeparatorLine(line: string): boolean {
  if (!line.includes("|")) return false;
  const cells = line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
  if (!cells.length) return false;
  return cells.every((c) => !c || /^:?-{2,}:?$/.test(c));
}

function isTableRow(line: string): boolean {
  const s = line.trim();
  return s.startsWith("|") && s.endsWith("|") && (s.match(/\|/g)?.length ?? 0) >= 2;
}

function tableRowToPlain(line: string): string {
  const cells = line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c && !/^:?-{2,}:?$/.test(c));
  if (!cells.length) return "";
  if (cells.length === 1) return `- ${cells[0]}`;
  if (cells.length === 2) return `- ${cells[0]}: ${cells[1]}`;
  return `- ${cells.join(" • ")}`;
}
