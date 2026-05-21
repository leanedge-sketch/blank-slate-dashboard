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
