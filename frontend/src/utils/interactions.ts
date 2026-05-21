import { api, Interaction, InteractionListResponse } from "../services/api";

const PAGE_SIZE = 500;
const MAX_INTERACTIONS = 2000;

/** Fetch every interaction for a customer (paginated API). */
export async function fetchAllCustomerInteractions(
  customerId: string,
  options?: { startDate?: string; endDate?: string },
): Promise<{ interactions: Interaction[]; total: number }> {
  const all: Interaction[] = [];
  let offset = 0;
  let total = 0;

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
    all.push(...page);

    if (page.length < PAGE_SIZE || all.length >= total) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return { interactions: all, total: Math.max(total, all.length) };
}

/** Format live DB interactions for the Deep Dive CRM History tab. */
export function formatInteractionsForCrmTab(
  interactions: Interaction[],
  total?: number,
): string {
  if (!interactions.length) {
    return "No CRM interactions recorded for this customer in the database.";
  }

  const count = total ?? interactions.length;
  const lines: string[] = [
    `Source: Live database (${count} interaction${count === 1 ? "" : "s"}, newest first)`,
    "",
    "Complete interaction index:",
  ];

  interactions.forEach((it, idx) => {
    const ts = it.created_at
      ? new Date(it.created_at).toLocaleString()
      : "unknown time";
    const preview =
      (it.input_text || "").trim() ||
      (it.ai_response || "").trim() ||
      "[empty]";
    const short = preview.replace(/\s+/g, " ").slice(0, 200);
    lines.push(`${idx + 1}. [${ts}] ${short}${preview.length > 200 ? "…" : ""}`);
  });

  lines.push("", "Full transcripts (newest first):", "");
  interactions.forEach((it) => {
    const ts = it.created_at
      ? new Date(it.created_at).toLocaleString()
      : "unknown time";
    lines.push(`--- Interaction at ${ts} ---`);
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
