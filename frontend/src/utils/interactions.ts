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
  conversationArchiveTotal: number;
  pipelineArchiveTotal: number;
}

/** Fetch unified history (interactions table + conversation archive, merged). */
export async function fetchAllCustomerInteractions(
  customerId: string,
  options?: { startDate?: string; endDate?: string },
): Promise<CustomerInteractionBundle> {
  const all: Interaction[] = [];
  let offset = 0;
  let total = 0;
  let interactionsTableTotal = 0;
  let conversationArchiveTotal = 0;

  while (all.length < MAX_INTERACTIONS) {
    const params: Record<string, string | number | boolean> = {
      limit: PAGE_SIZE,
      offset,
      include_conversation: true,
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
    conversationArchiveTotal =
      res.data.conversation_total ?? conversationArchiveTotal;
    pipelineArchiveTotal = res.data.pipeline_total ?? pipelineArchiveTotal;
    all.push(...page);

    if (page.length < PAGE_SIZE || all.length >= total) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return {
    interactions: all,
    total: Math.max(total, all.length),
    interactionsTableTotal,
    conversationArchiveTotal,
    pipelineArchiveTotal,
  };
}

export function isConversationArchiveRow(interaction: Interaction): boolean {
  return interaction.history_source === "conversation";
}

export function isPipelineArchiveRow(interaction: Interaction): boolean {
  return interaction.history_source === "pipeline";
}

/** Format unified CRM history for Deep Dive tab. */
export function formatInteractionsForCrmTab(
  interactions: Interaction[],
  total?: number,
): string {
  const count = total ?? interactions.length;
  const tableCount = interactions.filter(
    (it) => !isConversationArchiveRow(it),
  ).length;
  const archiveCount = interactions.filter((it) =>
    isConversationArchiveRow(it),
  ).length;

  if (!interactions.length) {
    return (
      "No CRM history found in public.interactions or public.conversation for this customer."
    );
  }

  const lines: string[] = [
    `Source: Supabase merged timeline (${count} row${count === 1 ? "" : "s"}: ${tableCount} from interactions table, ${archiveCount} from conversation archive)`,
    "",
    "Complete history index:",
  ];

  interactions.forEach((it, idx) => {
    const ts = it.created_at
      ? new Date(it.created_at).toLocaleString()
      : "unknown time";
    const src = isConversationArchiveRow(it) ? " [RAG archive]" : "";
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
    const label = isConversationArchiveRow(it)
      ? "RAG conversation archive"
      : isPipelineArchiveRow(it)
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
