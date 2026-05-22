import { api, Interaction, InteractionListResponse } from "../services/api";

const PAGE_SIZE = 500;
const MAX_INTERACTIONS = 2000;

export interface ConversationLog {
  id: string;
  content: string;
  created_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CustomerInteractionBundle {
  interactions: Interaction[];
  total: number;
  interactionsTableTotal: number;
  pipelineArchiveTotal: number;
}

/** Fetch CRM history from public.interactions + sales_pipeline only. */
export async function fetchAllCustomerInteractions(
  customerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
  },
): Promise<CustomerInteractionBundle> {
  const all: Interaction[] = [];
  let offset = 0;
  let total = 0;
  let interactionsTableTotal = 0;
  let pipelineArchiveTotal = 0;

  while (all.length < MAX_INTERACTIONS) {
    const params: Record<string, string | number> = {
      limit: PAGE_SIZE,
      offset,
    };
    if (options?.startDate) params.start_date = options.startDate;
    if (options?.endDate) params.end_date = options.endDate;

    const res = await api.get<InteractionListResponse>(
      `/crm/customers/${customerId}/interactions`,
      { params },
    );
    const page = res.data.interactions ?? [];
    total = res.data.total ?? page.length;
    interactionsTableTotal =
      res.data.interactions_table_total ?? interactionsTableTotal;
    pipelineArchiveTotal = res.data.pipeline_total ?? pipelineArchiveTotal;
    all.push(...page);

    if (page.length < PAGE_SIZE || all.length >= total) {
      break;
    }
    offset += PAGE_SIZE;
  }

  const visible = all.filter((it) => !isRawChatgptExportLeak(it));

  return {
    interactions: visible,
    total: visible.length,
    interactionsTableTotal,
    pipelineArchiveTotal,
  };
}

/** Legacy RAG / ChatGPT rows — never shown in CRM after conversation table disconnect. */
export function isConversationArchiveRow(_interaction: Interaction): boolean {
  return false;
}

export function isPipelineArchiveRow(interaction: Interaction): boolean {
  return interaction.history_source === "pipeline";
}

export function isChatgptExportRow(interaction: Interaction): boolean {
  return interaction.history_source === "chatgpt_export";
}

/** Unparsed conversations.json dump leaked into public.interactions. */
export function isRawChatgptExportLeak(interaction: Interaction): boolean {
  const combined = `${interaction.input_text || ""}\n${interaction.ai_response || ""}`;
  if (combined.length < 120) {
    return false;
  }
  let hits = 0;
  if (/title:\s*.+/i.test(combined)) hits += 1;
  if (/create_time:\s*[\d.]+/i.test(combined)) hits += 1;
  if (/['"]mapping['"]\s*:/i.test(combined) || /mapping:\s*\{/i.test(combined)) {
    hits += 1;
  }
  if (hits >= 2) return true;
  if (
    combined.includes("children") &&
    combined.includes("'message':") &&
    combined.includes("author")
  ) {
    return true;
  }
  const user = (interaction.input_text || "").trim();
  if (/relationship\s+insights/i.test(user)) return true;
  return false;
}

/** @deprecated ChatGPT/RAG archive rows are no longer merged into CRM history. */
export function isArchivedChatgptUiRow(interaction: Interaction): boolean {
  return isChatgptExportRow(interaction) || isConversationArchiveRow(interaction);
}

/** Format unified CRM history for Deep Dive tab. */
export function formatInteractionsForCrmTab(
  interactions: Interaction[],
  total?: number,
): string {
  const count = total ?? interactions.length;
  const tableCount = interactions.filter(
    (it) => !isPipelineArchiveRow(it) && !isChatgptExportRow(it),
  ).length;
  const pipelineCount = interactions.filter((it) => isPipelineArchiveRow(it)).length;

  if (!interactions.length) {
    return "No CRM history found in public.interactions or pipeline for this customer.";
  }

  const lines: string[] = [
    `Source: Supabase CRM timeline (${count} row${count === 1 ? "" : "s"}: ${tableCount} interactions, ${pipelineCount} pipeline)`,
    "",
    "Complete history index:",
  ];

  interactions.forEach((it, idx) => {
    const ts = it.created_at
      ? new Date(it.created_at).toLocaleString()
      : "unknown time";
    const src = isPipelineArchiveRow(it) ? " [pipeline]" : "";
    const preview =
      (it.input_text || "").trim() ||
      (it.ai_response || "").trim() ||
      "[empty]";
    const short = preview.replace(/\s+/g, " ").slice(0, 200);
    lines.push(
      `${idx + 1}. [${ts}]${src} ${short}${preview.length > 200 ? "…" : ""}`,
    );
  });

  lines.push("", "Full transcripts (newest first):", "");
  interactions.forEach((it) => {
    const ts = it.created_at
      ? new Date(it.created_at).toLocaleString()
      : "unknown time";
    const label = isPipelineArchiveRow(it)
      ? "Pipeline chat (sales_pipeline.ai_interactions)"
      : "CRM interaction";
    lines.push(`--- ${label} at ${ts} ---`);
    if (it.input_text?.trim()) {
      lines.push(`Sales/Customer note: ${it.input_text.trim()}`);
    }
    if (it.ai_response?.trim()) {
      lines.push(`AI response/summary: ${it.ai_response.trim()}`);
    }
    if (it.file_url) {
      lines.push(`Attachment: ${it.file_url}`);
    }
    lines.push("");
  });

  return lines.join("\n").trim();
}
