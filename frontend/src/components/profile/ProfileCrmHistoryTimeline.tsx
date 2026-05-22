import { useMemo, useState } from "react";
import type { Interaction } from "../../services/api";
import { isPipelineArchiveRow } from "../../utils/interactions";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";

function displayBody(it: Interaction): string {
  const parts: string[] = [];
  if (it.input_text?.trim()) {
    parts.push(`Note: ${it.input_text.trim()}`);
  }
  if (it.ai_response?.trim()) {
    parts.push(`AI: ${it.ai_response.trim()}`);
  }
  return parts.join("\n\n") || "[Empty interaction]";
}

function needsClamp(text: string): boolean {
  return text.split("\n").length > 3 || text.length > 280;
}

export function ProfileCrmHistoryTimeline({
  interactions,
  maxVisible = 20,
}: {
  interactions: Interaction[];
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const visible = useMemo(
    () => interactions.slice(0, maxVisible),
    [interactions, maxVisible],
  );

  if (!visible.length) {
    return (
      <p className="text-sm text-slate-500 italic m-0 py-4">
        No CRM history loaded. Regenerate ICP or check Supabase connection.
      </p>
    );
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="relative pl-4 border-l-2 border-slate-200 space-y-4">
      {interactions.length > maxVisible ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 -ml-4 mb-2">
          Showing newest {maxVisible} of {interactions.length} merged entries.
        </p>
      ) : null}

      {visible.map((it) => {
        const id = it.id;
        const isOpen = expanded.has(id);
        const body = displayBody(it);
        const clamp = needsClamp(body) && !isOpen;
        const fromPipeline = isPipelineArchiveRow(it);
        const ts = it.created_at
          ? new Date(it.created_at).toLocaleString()
          : "Unknown date";

        return (
          <article
            key={id}
            className="relative rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ease-out hover:border-slate-300"
          >
            <span className="absolute -left-[1.35rem] top-5 h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow" />

            <button
              type="button"
              onClick={() => toggle(id)}
              className="w-full text-left px-4 pt-4 pb-2 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <time className="text-xs font-medium text-slate-500">{ts}</time>
                  {fromPipeline ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Pipeline chat
                    </span>
                  ) : (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      CRM log
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <MessageSquare size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">
                    {(it.input_text || it.ai_response || "Interaction").slice(0, 72)}
                    {(it.input_text || it.ai_response || "").length > 72 ? "…" : ""}
                  </span>
                </div>
              </div>
              {clamp || isOpen ? (
                isOpen ? (
                  <ChevronUp size={18} className="text-slate-400 shrink-0 mt-1" />
                ) : (
                  <ChevronDown size={18} className="text-slate-400 shrink-0 mt-1" />
                )
              ) : null}
            </button>

            <div className="px-4 pb-4">
              <div
                className={`text-sm text-slate-700 leading-relaxed whitespace-pre-wrap transition-all duration-300 ease-in-out ${
                  clamp ? "line-clamp-3" : ""
                }`}
              >
                {body}
              </div>
              {clamp ? (
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Read more
                </button>
              ) : null}
              {isOpen && needsClamp(body) ? (
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Show less
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
