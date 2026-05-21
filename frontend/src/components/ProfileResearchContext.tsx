export interface ProfileResearchMeta {
  crm_interaction_count_full_text?: number;
  rag_document_count?: number;
  rag_chars?: number;
  rag_truncated?: boolean;
  crm_interaction_count?: number;
  crm_chars?: number;
  crm_truncated?: boolean;
  web_search_available?: boolean;
  web_search_chars?: number;
  web_truncated?: boolean;
  linkedin_available?: boolean;
  linkedin_chars?: number;
  linkedin_truncated?: boolean;
  total_research_chars_raw?: number;
  total_research_chars_sent?: number;
  context_max_chars?: number;
  context_capped?: boolean;
}

function StatCard({
  label,
  value,
  detail,
  ok,
}: {
  label: string;
  value: string;
  detail?: string;
  ok: boolean;
}) {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderRadius: "0.75rem",
        border: `2px solid ${ok ? "#3b82f6" : "#e5e7eb"}`,
        backgroundColor: ok ? "#eff6ff" : "#f9fafb",
      }}
    >
      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", marginBottom: "0.35rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.35rem", fontWeight: 800, color: ok ? "#1e40af" : "#9ca3af" }}>
        {value}
      </div>
      {detail ? (
        <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.35rem" }}>{detail}</div>
      ) : null}
    </div>
  );
}

export function ProfileResearchContext({ meta }: { meta?: ProfileResearchMeta | null }) {
  if (!meta || Object.keys(meta).length === 0) return null;

  const ragCount = meta.rag_document_count ?? 0;
  const crmCount = meta.crm_interaction_count ?? 0;
  const webOk = Boolean(meta.web_search_available);
  const linkedinOk = Boolean(meta.linkedin_available);
  const totalSent = meta.total_research_chars_sent ?? 0;
  const totalRaw = meta.total_research_chars_raw ?? totalSent;

  return (
    <section
      className="card"
      style={{
        marginBottom: "2rem",
        padding: "1.5rem 2rem",
        backgroundColor: "#ffffff",
      }}
    >
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          marginBottom: "0.5rem",
          paddingBottom: "0.75rem",
          borderBottom: "3px solid #3b82f6",
        }}
      >
        Research context used
      </h3>
      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
        Sources sent to the AI for the last profile build. Regenerate the ICP to refresh after
        new interactions or web data.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <StatCard
          label="RAG documents"
          value={String(ragCount)}
          detail={
            meta.rag_chars
              ? `${meta.rag_chars.toLocaleString()} chars${meta.rag_truncated ? " (truncated)" : ""}`
              : undefined
          }
          ok={ragCount > 0}
        />
        <StatCard
          label="CRM interactions"
          value={String(crmCount)}
          detail={
            [
              meta.crm_chars
                ? `${meta.crm_chars.toLocaleString()} chars${meta.crm_truncated ? " (truncated in prompt)" : ""}`
                : undefined,
              meta.crm_interaction_count_full_text != null && crmCount > 0
                ? `${meta.crm_interaction_count_full_text} of ${crmCount} with full text in last build`
                : undefined,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          ok={crmCount > 0}
        />
        <StatCard
          label="Web search"
          value={webOk ? "Included" : "Empty"}
          detail={
            meta.web_search_chars
              ? `${meta.web_search_chars.toLocaleString()} chars${meta.web_truncated ? " (truncated)" : ""}`
              : "Check GOOGLE_PSE / SERPAPI keys"
          }
          ok={webOk}
        />
        <StatCard
          label="LinkedIn"
          value={linkedinOk ? "Included" : "Empty"}
          detail={
            meta.linkedin_chars
              ? `${meta.linkedin_chars.toLocaleString()} chars${meta.linkedin_truncated ? " (truncated)" : ""}`
              : undefined
          }
          ok={linkedinOk}
        />
      </div>
      <div
        style={{
          padding: "0.75rem 1rem",
          backgroundColor: "#f3f4f6",
          borderRadius: "0.5rem",
          fontSize: "0.9rem",
          color: "#374151",
        }}
      >
        <strong>Total research context:</strong> {totalSent.toLocaleString()} chars sent to the
        model
        {totalRaw !== totalSent ? ` (${totalRaw.toLocaleString()} chars gathered)` : ""}
        {meta.context_capped ? " — capped to fit model budget" : ""}
        {meta.context_max_chars
          ? ` · budget ${meta.context_max_chars.toLocaleString()} chars`
          : ""}
      </div>
    </section>
  );
}
