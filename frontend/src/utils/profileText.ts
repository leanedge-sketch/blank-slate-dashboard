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

export interface ProfileContact {
  name: string;
  position?: string;
  linkedin?: string;
  source?: string;
  email?: string;
}

export type NextStepTone = "action" | "muted" | "review";

export interface NextStepItem {
  text: string;
  tone: NextStepTone;
  index?: number;
}

/** Canonical ICP product categories (matches backend strategic-fit keys). */
export const ICP_PRODUCT_CATEGORIES = [
  "Cement",
  "Dry-Mix",
  "Admixtures",
  "Paint & Coatings",
] as const;

export type IcpProductCategory = (typeof ICP_PRODUCT_CATEGORIES)[number];

export interface CategoryRecommendation {
  category: IcpProductCategory;
  analysis: string;
  action: string;
  tone: NextStepTone;
  score?: number;
}

const CATEGORY_LINE_RE =
  /^(?:\d+[.)]\s*)?[-•]?\s*(Cement|Dry[- ]?Mix|Admixtures?|Paint\s*(?:&|and)\s*Coatings?)\s*[:–—-]\s*(.+)$/i;

const DEAD_END_RE =
  /\b(n\/a|not applicable|no fit|low fit|hold|pause|deprioriti[sz]e|wait until|no immediate|not recommended|avoid|skip|none at this time|no direct engagement|not a target|no near[- ]term|no opportunity|not prioritized)\b/i;

function classifyStepTone(text: string, score?: number): NextStepTone {
  const t = text.trim();
  if (!t) return "muted";
  if (score === 0) return "muted";
  if (DEAD_END_RE.test(t)) return "muted";
  if (/^review\b|^monitor\b|^assess\b/i.test(t)) return "review";
  return "action";
}

/** Map varied AI labels to canonical category names. */
export function normalizeCategoryLabel(raw: string): IcpProductCategory | null {
  const k = raw
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (k === "cement" || k.startsWith("cement ")) return "Cement";
  if (k === "dry mix" || k === "dry-mix" || k === "drymix") return "Dry-Mix";
  if (k === "admixture" || k === "admixtures") return "Admixtures";
  if (
    k === "paint & coatings" ||
    k === "paint and coatings" ||
    k === "paint coatings" ||
    k === "coatings" ||
    k.startsWith("paint ")
  ) {
    return "Paint & Coatings";
  }
  return null;
}

function splitAnalysisAndAction(text: string): { analysis: string; action: string } {
  const trimmed = text.trim();
  if (!trimmed) return { analysis: "", action: "" };

  const emDash = trimmed.split(/\s+—\s+/);
  if (emDash.length >= 2) {
    return {
      analysis: emDash[0].trim(),
      action: emDash.slice(1).join(" — ").trim(),
    };
  }

  const actionLabel = trimmed.match(/^(.+?)\.\s*Action:\s*(.+)$/is);
  if (actionLabel) {
    return { analysis: actionLabel[1].trim(), action: actionLabel[2].trim() };
  }

  const hyphenSplit = trimmed.match(/^(.+?)\s+-\s+([A-Z].+)$/);
  if (hyphenSplit && hyphenSplit[1].length > 20) {
    return { analysis: hyphenSplit[1].trim(), action: hyphenSplit[2].trim() };
  }

  if (DEAD_END_RE.test(trimmed) || /no direct engagement/i.test(trimmed)) {
    return { analysis: trimmed, action: "No direct engagement" };
  }

  const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length >= 2) {
    return {
      analysis: sentences.slice(0, -1).join(" ").trim(),
      action: sentences[sentences.length - 1].trim(),
    };
  }

  return { analysis: trimmed, action: trimmed };
}

function categoryMentionedInText(text: string): IcpProductCategory | null {
  const lower = text.toLowerCase();
  for (const cat of ICP_PRODUCT_CATEGORIES) {
    const key = cat.toLowerCase().replace("&", "and");
    if (lower.includes(key) || lower.startsWith(key.split(" ")[0])) {
      return cat;
    }
  }
  if (/\bdry[- ]?mix\b/i.test(text)) return "Dry-Mix";
  if (/\badmixture/i.test(text)) return "Admixtures";
  if (/\bcoatings?\b/i.test(text) && /\bpaint\b/i.test(text)) return "Paint & Coatings";
  if (/\bcement\b/i.test(text) && !/\bpaint\b/i.test(text)) return "Cement";
  return null;
}

function fitItemsByCategory(
  fitItems: StrategicFitItem[],
): Map<IcpProductCategory, StrategicFitItem> {
  const map = new Map<IcpProductCategory, StrategicFitItem>();
  for (const item of fitItems) {
    const norm = normalizeCategoryLabel(item.category);
    if (norm) map.set(norm, item);
  }
  return map;
}

function parseCategoryLinesFromActions(actionSource: string): Map<IcpProductCategory, string> {
  const byCategory = new Map<IcpProductCategory, string>();

  for (const line of actionSource.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^key contacts/i.test(trimmed)) continue;

    const direct = trimmed.match(CATEGORY_LINE_RE);
    if (direct) {
      const norm = normalizeCategoryLabel(direct[1]);
      if (norm) byCategory.set(norm, direct[2].trim());
      continue;
    }

    const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      const body = numbered[2].trim();
      const inline = body.match(CATEGORY_LINE_RE);
      if (inline) {
        const norm = normalizeCategoryLabel(inline[1]);
        if (norm) byCategory.set(norm, inline[2].trim());
        continue;
      }
      const mentioned = categoryMentionedInText(body);
      if (mentioned && !byCategory.has(mentioned)) {
        byCategory.set(mentioned, body);
      }
    }

    if (/^[-•]\s+/.test(trimmed)) {
      const bullet = trimmed.replace(/^[-•]\s+/, "").trim();
      const inline = bullet.match(CATEGORY_LINE_RE);
      if (inline) {
        const norm = normalizeCategoryLabel(inline[1]);
        if (norm) byCategory.set(norm, inline[2].trim());
      } else {
        const mentioned = categoryMentionedInText(bullet);
        if (mentioned && !byCategory.has(mentioned)) {
          byCategory.set(mentioned, bullet);
        }
      }
    }
  }

  return byCategory;
}

function buildCategoryRecommendations(
  actionSource: string,
  fitItems: StrategicFitItem[],
  fallbackItems: NextStepItem[],
): CategoryRecommendation[] {
  const parsed = parseCategoryLinesFromActions(actionSource);
  const fitMap = fitItemsByCategory(fitItems);

  if (!parsed.size && fallbackItems.length) {
    for (const item of fallbackItems) {
      const mentioned = categoryMentionedInText(item.text);
      if (mentioned && !parsed.has(mentioned)) {
        parsed.set(mentioned, item.text);
      }
    }
  }

  return ICP_PRODUCT_CATEGORIES.map((category) => {
    const fit = fitMap.get(category);
    const score = fit?.score;
    const raw = parsed.get(category);
    const { analysis, action } = raw
      ? splitAnalysisAndAction(raw)
      : {
          analysis: fit?.reason?.trim() ?? "",
          action: score === 0 ? "No direct engagement" : "",
        };

    const resolvedAction =
      action.trim() ||
      (score === 0 ? "No direct engagement" : "Define outreach and technical next step");
    const resolvedAnalysis =
      analysis.trim() || fit?.reason?.trim() || "No category-specific analysis in profile.";

    const tone = classifyStepTone(
      `${resolvedAnalysis} ${resolvedAction}`,
      score,
    );

    return {
      category,
      analysis: resolvedAnalysis,
      action: resolvedAction,
      tone,
      score,
    };
  });
}

function parseInlineContactFields(segment: string): ProfileContact | null {
  const name = segment.match(/\bName:\s*([^,]+)/i)?.[1]?.trim();
  if (!name) return null;
  return {
    name,
    position: segment.match(/\bPosition:\s*([^,]+)/i)?.[1]?.trim(),
    linkedin: segment.match(/\bLinkedIn:\s*(\S+)/i)?.[1]?.trim(),
    source: segment.match(/\bSource:\s*([^,]+)/i)?.[1]?.trim(),
    email: segment.match(/\bEmail:\s*(\S+)/i)?.[1]?.trim(),
  };
}

function parseCommaSeparatedContactLine(line: string): ProfileContact | null {
  const linkedin = line.match(/(https?:\/\/[^\s,]*linkedin\.com[^\s,]*)/i)?.[1];
  const withoutUrl = line.replace(/(https?:\/\/[^\s,]*linkedin\.com[^\s,]*)/i, "").trim();
  const parts = withoutUrl.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const name = parts[0].replace(/^name:\s*/i, "").trim();
  if (!name || name.length > 80) return null;
  return {
    name,
    position: parts[1].replace(/^position:\s*/i, "").trim(),
    linkedin,
    source: parts[2]?.replace(/^source:\s*/i, "").trim(),
  };
}

function dedupeContacts(contacts: ProfileContact[]): ProfileContact[] {
  const seen = new Set<string>();
  const out: ProfileContact[] = [];
  for (const c of contacts) {
    const key = `${c.name.toLowerCase()}|${c.linkedin ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Parse Key Contacts blocks from section 4 or LinkedIn subsection text. */
export function parseKeyContacts(text: string): ProfileContact[] {
  if (!text?.trim()) return [];

  const contacts: ProfileContact[] = [];
  let current: ProfileContact | null = null;

  const flush = () => {
    if (current?.name?.trim()) {
      const name = current.name.trim();
      if (name.includes(",") && /name:/i.test(name)) {
        const inline = parseInlineContactFields(name);
        if (inline) contacts.push(inline);
      } else if (name.split(",").length >= 3 && !/^name:/i.test(name)) {
        const split = parseCommaSeparatedContactLine(name);
        if (split) contacts.push(split);
        else contacts.push({ ...current, name });
      } else {
        contacts.push({
          name,
          position: current.position?.trim(),
          linkedin: current.linkedin?.trim(),
          source: current.source?.trim(),
          email: current.email?.trim(),
        });
      }
    }
    current = null;
  };

  const normalized = text.replace(/\r\n/g, "\n");
  const multiNameSegments = normalized.split(/(?=\bName:\s)/i).filter((s) => s.trim());

  if (multiNameSegments.length > 1) {
    for (const segment of multiNameSegments) {
      const inline = parseInlineContactFields(segment);
      if (inline?.name) contacts.push(inline);
    }
    if (contacts.length) return dedupeContacts(contacts);
  }

  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if ((trimmed.match(/\bName:/gi) || []).length > 1) {
      for (const segment of trimmed.split(/,\s*(?=Name:)/i)) {
        const inline = parseInlineContactFields(segment);
        if (inline?.name) contacts.push(inline);
      }
      continue;
    }

    const inlineOnly = parseInlineContactFields(trimmed);
    if (inlineOnly?.name && /^name:/i.test(trimmed)) {
      flush();
      contacts.push(inlineOnly);
      continue;
    }

    const commaContact = parseCommaSeparatedContactLine(trimmed);
    if (commaContact && !/^name:/i.test(trimmed)) {
      contacts.push(commaContact);
      continue;
    }

    if (/^name:/i.test(trimmed)) {
      flush();
      current = { name: trimmed.replace(/^name:\s*/i, "").trim() };
      continue;
    }
    if (!current) {
      if (/linkedin\.com/i.test(trimmed)) {
        const url = trimmed.match(/(https?:\/\/\S+)/)?.[1] ?? trimmed;
        contacts.push({ name: "Contact", linkedin: url });
      }
      continue;
    }
    if (/^position:/i.test(trimmed)) {
      current.position = trimmed.replace(/^position:\s*/i, "");
    } else if (/^linkedin:/i.test(trimmed)) {
      current.linkedin = trimmed.replace(/^linkedin:\s*/i, "");
    } else if (/^source:/i.test(trimmed)) {
      current.source = trimmed.replace(/^source:\s*/i, "");
    } else if (/^email:/i.test(trimmed)) {
      current.email = trimmed.replace(/^email:\s*/i, "");
    }
  }
  flush();
  return dedupeContacts(contacts);
}

/** Split next-steps section into review prose vs category action bullets. */
export function parseNextStepsContent(
  body: string,
  fitItems: StrategicFitItem[] = [],
): {
  interactionReview: string;
  items: NextStepItem[];
  categories: CategoryRecommendation[];
} {
  if (!body?.trim()) {
    return {
      interactionReview: "",
      items: [],
      categories: buildCategoryRecommendations("", fitItems, []),
    };
  }

  const sub = extractLabeledSubsections(body, {
    review: ["interaction review", "interaction review (from crm)"],
    actions: ["strategic actions", "recommended actions", "next steps"],
    contacts: ["key contacts", "key contacts for engagement"],
  });

  const interactionReview = sub.review?.trim() ?? "";
  const actionSource = sub.actions?.trim() || body;
  const items: NextStepItem[] = [];

  for (const line of actionSource.split("\n")) {
    const trimmed = line.trim();
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      const text = numbered[2].trim();
      items.push({
        index: parseInt(numbered[1], 10),
        text,
        tone: classifyStepTone(text),
      });
      continue;
    }
    if (/^[-•]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[-•]\s+/, "").trim();
      if (text.length > 8) {
        items.push({ text, tone: classifyStepTone(text) });
      }
    }
  }

  if (!items.length) {
    for (const block of actionSource.split(/\n{2,}/)) {
      const t = block.trim();
      if (t.length > 12 && !/^key contacts/i.test(t)) {
        items.push({ text: t, tone: classifyStepTone(t) });
      }
    }
  }

  const categories = buildCategoryRecommendations(actionSource, fitItems, items);

  return { interactionReview, items, categories };
}

/** Extract Key Contacts subsection only (avoids comma blobs from strategic actions). */
export function extractKeyContactsSection(body: string): string {
  if (!body?.trim()) return "";
  const sub = extractLabeledSubsections(body, {
    contacts: ["key contacts", "key contacts for engagement"],
  });
  return sub.contacts?.trim() ?? "";
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
