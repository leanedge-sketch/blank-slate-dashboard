import { useState } from "react";
import type { DeepDiveTabId } from "../utils/profileText";
import type { ProfileResearchMeta } from "./ProfileResearchContext";
import { ProfileProse } from "./ProfileProse";
import { ProfileCrmHistoryTimeline } from "./profile/ProfileCrmHistoryTimeline";
import type { Interaction } from "../services/api";

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
        ? `${meta.crm_interaction_count} in last build`
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

export function ProfileDeepDiveTabs({
  deepDive,
  meta,
  fallbackBody,
  mergedInteractions = [],
}: {
  deepDive: Record<DeepDiveTabId, string>;
  meta?: ProfileResearchMeta | null;
  fallbackBody?: string;
  mergedInteractions?: Interaction[];
}) {
  const [active, setActive] = useState<DeepDiveTabId>("crm");

  const proseContent =
    active === "crm"
      ? ""
      : deepDive[active]?.trim() ||
        (active === "crm" && fallbackBody?.trim() ? fallbackBody : "");

  const showCrmTimeline = active === "crm" && mergedInteractions.length > 0;
  const showCrmProse =
    active === "crm" && !mergedInteractions.length && (deepDive.crm || fallbackBody);
  const crmProseText = deepDive.crm?.trim() || fallbackBody?.trim() || "";

  const totalChars = Object.values(deepDive).reduce((n, s) => n + s.length, 0);

  return (
    <section className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-6 pt-6 pb-2 sm:px-8">
        <h2 className="text-xl font-bold text-slate-900 m-0">Deep Dive — Research Sources</h2>
        <p className="text-sm text-slate-500 mt-1 mb-0">
          Large research payloads — scroll within each tab
          {totalChars > 0 ? ` (${totalChars.toLocaleString()} characters in profile text)` : ""}.
          {meta?.context_capped ? " Some sources were truncated for the AI budget." : ""}
        </p>
      </div>

      <div
        role="tablist"
        className="flex flex-wrap gap-1 px-4 sm:px-6 border-b border-slate-200"
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const hint = tabMetaHint(tab.id, meta);
          const countLabel =
            tab.id === "crm" && mergedInteractions.length
              ? `${mergedInteractions.length} entries`
              : deepDive[tab.id]?.length
                ? `${(deepDive[tab.id].length / 1000).toFixed(1)}k chars`
                : "";

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-blue-600 text-blue-700 bg-blue-50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              {(hint || countLabel) && (
                <span
                  className={`block text-[10px] font-normal mt-0.5 ${
                    isActive ? "text-blue-500" : "text-slate-400"
                  }`}
                >
                  {[hint, countLabel].filter(Boolean).join(" · ")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="max-h-[600px] overflow-y-auto bg-slate-50/80 px-6 py-6 sm:px-8 sm:py-7 scroll-smooth"
      >
        {showCrmTimeline ? (
          <ProfileCrmHistoryTimeline interactions={mergedInteractions} maxVisible={20} />
        ) : showCrmProse && crmProseText ? (
          <ProfileProse body={crmProseText} compact />
        ) : proseContent ? (
          <ProfileProse body={proseContent} compact />
        ) : (
          <p className="text-sm text-slate-400 italic m-0">
            {active === "rag"
              ? "No highly relevant documents found for this profile. RAG only shows snippets linked to this company (customer ID, name, or domain) with strong similarity."
              : `No ${TABS.find((t) => t.id === active)?.label} content. Regenerate ICP after adding CRM notes or configuring search keys.`}
          </p>
        )}
      </div>
    </section>
  );
}
