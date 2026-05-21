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

export interface ProfileSection {
  index: number;
  title: string;
  body: string;
}

const PROFILE_SECTION_HEADING_RE = /^(\d+)\.\s+(.+)$/;

/**
 * Split ICP prose into numbered sections (0–4) preserving full body text.
 */
export function parseProfileSections(text: string): ProfileSection[] {
  const cleaned = stripProfileMarkdown(text || "");
  if (!cleaned.trim()) return [];

  const lines = cleaned.split("\n");
  const sections: ProfileSection[] = [];
  let current: ProfileSection | null = null;
  const bodyLines: string[] = [];

  const flush = () => {
    if (current) {
      current.body = bodyLines.join("\n").trim();
      sections.push(current);
    }
    bodyLines.length = 0;
  };

  for (const line of lines) {
    const match = line.match(PROFILE_SECTION_HEADING_RE);
    if (match) {
      flush();
      current = {
        index: parseInt(match[1], 10),
        title: match[2].trim(),
        body: "",
      };
      continue;
    }
    bodyLines.push(line);
  }
  flush();

  if (!sections.length && cleaned.trim()) {
    return [{ index: -1, title: "", body: cleaned.trim() }];
  }

  return sections.sort((a, b) => a.index - b.index);
}

export type DeepDiveTabId = "crm" | "rag" | "web" | "linkedin";

const DEEP_DIVE_ALIASES: Record<DeepDiveTabId, string[]> = {
  crm: ["crm interactions", "crm history"],
  rag: ["rag documents", "rag", "past-case snippets"],
  web: ["web search", "web research", "verified company facts"],
  linkedin: ["linkedin", "linkedin profiles", "linkedin contacts"],
};

const NEXT_STEPS_SUBSECTION_ALIASES: Record<string, string[]> = {
  "key contacts": ["key contacts", "key contacts for engagement"],
  "interaction review": ["interaction review", "interaction review (from crm)"],
};

function normalizeSubsectionKey(line: string): string {
  return line
    .trim()
    .replace(/^[-•]\s+/, "")
    .replace(/:$/, "")
    .toLowerCase();
}

function matchesAnyAlias(key: string, aliases: string[]): boolean {
  return aliases.some(
    (a) =>
      key === a ||
      key.startsWith(`${a} `) ||
      key.startsWith(`${a}:`) ||
      key.startsWith(`${a}—`) ||
      key.startsWith(`${a} -`),
  );
}

/** Pull labeled subsections from any profile section body. */
export function extractLabeledSubsections(
  body: string,
  aliasMap: Record<string, string[]>,
): Record<string, string> {
  const buffers: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    const key = normalizeSubsectionKey(trimmed);

    let matched: string | null = null;
    for (const [id, aliases] of Object.entries(aliasMap)) {
      if (matchesAnyAlias(key, aliases)) {
        matched = id;
        break;
      }
    }
    if (matched) {
      current = matched;
      if (!buffers[current]) buffers[current] = [];
      continue;
    }
    if (/^total research context:/i.test(trimmed)) {
      current = null;
      continue;
    }
    if (current) {
      if (!buffers[current]) buffers[current] = [];
      buffers[current].push(line);
    }
  }

  const out: Record<string, string> = {};
  for (const [id, lines] of Object.entries(buffers)) {
    out[id] = lines.join("\n").trim();
  }
  return out;
}

/** Pull RAG / CRM / Web / LinkedIn bodies from section 0 research summary. */
export function extractResearchSubsections(section0Body: string): Record<DeepDiveTabId, string> {
  const raw = extractLabeledSubsections(section0Body, DEEP_DIVE_ALIASES);
  return {
    crm: raw.crm ?? "",
    rag: raw.rag ?? "",
    web: raw.web ?? "",
    linkedin: raw.linkedin ?? "",
  };
}

/** Collect LinkedIn URLs and contact blocks from anywhere in the profile. */
export function extractLinkedInMentions(fullText: string): string {
  const lines = fullText.split("\n");
  const blocks: string[] = [];
  let contactBlock: string[] = [];

  const flushContact = () => {
    if (contactBlock.some((l) => /linkedin\.com/i.test(l))) {
      blocks.push(contactBlock.join("\n").trim());
    }
    contactBlock = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^name:/i.test(trimmed)) {
      flushContact();
      contactBlock = [line];
    } else if (contactBlock.length > 0) {
      contactBlock.push(line);
      if (/^source:/i.test(trimmed)) {
        flushContact();
      }
    } else if (/linkedin\.com/i.test(trimmed)) {
      blocks.push(trimmed);
    }
  }
  flushContact();

  const unique = [...new Set(blocks.filter(Boolean))];
  return unique.join("\n\n");
}

function buildDeepDiveWithFallbacks(
  section0Body: string,
  nextStepsBody: string,
  fullText: string,
): Record<DeepDiveTabId, string> {
  const fromResearch = extractResearchSubsections(section0Body);
  const fromNextSteps = extractLabeledSubsections(nextStepsBody, NEXT_STEPS_SUBSECTION_ALIASES);

  const linkedinFallback =
    fromNextSteps["key contacts"] || extractLinkedInMentions(fullText);

  const crmFallback = fromNextSteps["interaction review"] || "";

  const webFromProfile = extractLabeledSubsections(fullText, {
    web: DEEP_DIVE_ALIASES.web,
  }).web;

  const ragFromProfile = extractLabeledSubsections(fullText, {
    rag: DEEP_DIVE_ALIASES.rag,
  }).rag;

  const withNote = (primary: string, fallback: string, note: string) => {
    if (primary.trim()) return primary.trim();
    if (!fallback.trim()) return "";
    return `${note}\n\n${fallback.trim()}`;
  };

  return {
    crm: withNote(
      fromResearch.crm,
      crmFallback,
      "— From Interaction Review (profile section 4)",
    ),
    rag: withNote(fromResearch.rag, ragFromProfile ?? "", "— From RAG mentions in profile"),
    web: withNote(fromResearch.web, webFromProfile ?? "", "— From web mentions in profile"),
    linkedin: withNote(
      fromResearch.linkedin,
      linkedinFallback,
      "— From Key Contacts / LinkedIn URLs in profile",
    ),
  };
}

/** Locate a numbered section by index or fuzzy title match. */
export function findProfileSection(
  sections: ProfileSection[],
  index: number,
  ...titleIncludes: string[]
): ProfileSection | undefined {
  const byIndex = sections.find((s) => s.index === index);
  if (byIndex) return byIndex;
  const lower = titleIncludes.map((t) => t.toLowerCase());
  return sections.find((s) =>
    lower.some((k) => s.title.toLowerCase().includes(k)),
  );
}

export interface ParsedICPProfile {
  sections: ProfileSection[];
  snapshot: ProfileSection | undefined;
  footprint: ProfileSection | undefined;
  strategicFit: ProfileSection | undefined;
  nextSteps: ProfileSection | undefined;
  researchSummary: ProfileSection | undefined;
  deepDive: Record<DeepDiveTabId, string>;
}

export function parseICPProfile(text: string): ParsedICPProfile {
  const sections = parseProfileSections(text);
  const researchSummary = findProfileSection(
    sections,
    0,
    "research context",
  );
  const nextSteps = findProfileSection(
    sections,
    4,
    "recommended next steps",
    "next steps",
  );
  const section0Body = researchSummary?.body ?? "";
  const nextStepsBody = nextSteps?.body ?? "";

  return {
    sections,
    snapshot: findProfileSection(sections, 1, "company snapshot"),
    footprint: findProfileSection(sections, 2, "construction footprint"),
    strategicFit: findProfileSection(sections, 3, "strategic fit"),
    nextSteps,
    researchSummary,
    deepDive: buildDeepDiveWithFallbacks(section0Body, nextStepsBody, text),
  };
}
