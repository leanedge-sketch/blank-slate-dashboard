import { useState } from "react";
import type { DeepDiveTabId } from "../utils/profileText";
import type { ProfileResearchMeta } from "./ProfileResearchContext";
import { ProfileProse } from "./ProfileProse";

const TABS: { id: DeepDiveTabId; label: string }[] = [
  { id: "crm", label: "CRM History" },
  { id: "rag", label: "RAG Documents" },
  { id: "web", label: "Web Search" },
  { id: "linkedin", label: "LinkedIn" },
];

function tabMetaHint(id: DeepDiveTabId, meta?: ProfileResearchMeta | null): string {
  if (!meta) return "";
  switch (id) {
    case "crm":
      return meta.crm_interaction_count != null
        ? `${meta.crm_interaction_count} interactions`
        : "";
    case "rag":
      return meta.rag_document_count != null ? `${meta.rag_document_count} docs` : "";
    case "web":
      return meta.web_search_available ? "Web included" : "No web data";
    case "linkedin":
      return meta.linkedin_available ? "Profiles found" : "No profiles";
    default:
      return "";
  }
}

function charCount(text: string): string {
  const n = text.length;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k chars`;
  return `${n} chars`;
}

export function ProfileDeepDiveTabs({
  deepDive,
  meta,
  fallbackBody,
  liveCrmHistory,
}: {
  deepDive: Record<DeepDiveTabId, string>;
  meta?: ProfileResearchMeta | null;
  /** Full section 0 body when subsections could not be parsed */
  fallbackBody?: string;
  /** All interactions loaded from the database (preferred for CRM History tab) */
  liveCrmHistory?: string;
}) {
  const [active, setActive] = useState<DeepDiveTabId>("crm");

  const content =
    (active === "crm" && liveCrmHistory?.trim()) ||
    deepDive[active]?.trim() ||
    (active === "crm" && fallbackBody?.trim() ? fallbackBody : "");

  const totalChars = Object.values(deepDive).reduce((n, s) => n + s.length, 0);

  return (
    <section
      className="card profile-deep-dive"
      style={{
        marginTop: "2rem",
        padding: 0,
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      <div style={{ padding: "1.5rem 2rem 0" }}>
        <h3
          style={{
            fontSize: "1.35rem",
            fontWeight: 700,
            marginBottom: "0.35rem",
            color: "#111827",
          }}
        >
          Deep Dive — Research Sources
        </h3>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "1rem", marginTop: 0 }}>
          Raw research fed into the last profile build. Scroll within each tab for large exports
          {totalChars > 0 ? ` (${totalChars.toLocaleString()} characters total)` : ""}.
          {meta?.context_capped ? " Some sources were truncated to fit the model budget." : ""}
        </p>
      </div>

      <div
        role="tablist"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.25rem",
          padding: "0 1.5rem",
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const hint = tabMetaHint(tab.id, meta);
          const size =
            tab.id === "crm" && liveCrmHistory
              ? liveCrmHistory.length
              : deepDive[tab.id]?.length ?? 0;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              style={{
                padding: "0.75rem 1.25rem",
                marginBottom: "-2px",
                border: "none",
                borderBottom: isActive ? "3px solid #2563eb" : "3px solid transparent",
                background: isActive ? "#eff6ff" : "transparent",
                color: isActive ? "#1d4ed8" : "#4b5563",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.9rem",
                cursor: "pointer",
                borderRadius: "0.5rem 0.5rem 0 0",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {tab.label}
              {(hint || size > 0) && (
                <span
                  style={{
                    display: "block",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    color: isActive ? "#3b82f6" : "#9ca3af",
                    marginTop: "0.15rem",
                  }}
                >
                  {[hint, size > 0 ? charCount(deepDive[tab.id]) : ""].filter(Boolean).join(" · ")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        style={{
          maxHeight: "600px",
          overflowY: "auto",
          padding: "1.5rem 2rem 2rem",
          backgroundColor: "#fafbfc",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        {content ? (
          <ProfileProse body={content} compact />
        ) : (
          <p style={{ color: "#9ca3af", fontStyle: "italic", margin: 0 }}>
            No {TABS.find((t) => t.id === active)?.label} content in this profile. Regenerate the
            ICP after adding CRM notes or configuring search keys.
          </p>
        )}
      </div>
    </section>
  );
}
