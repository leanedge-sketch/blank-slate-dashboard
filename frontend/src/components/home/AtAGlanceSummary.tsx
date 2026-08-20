import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "../../services/api";

interface AtAGlancePayload {
  summary_markdown: string;
  metrics_payload?: Record<string, unknown>;
  provider_used?: string;
  is_fallback?: boolean;
  is_live_sql?: boolean;
  created_at?: string;
}

function parseBullets(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function minutesAgoLabel(createdAt?: string): string {
  if (!createdAt) return "Updated just now";
  const then = new Date(createdAt).getTime();
  if (Number.isNaN(then)) return "Updated just now";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  return `Updated ${mins}m ago`;
}

export function AtAGlanceSummary() {
  const [data, setData] = useState<AtAGlancePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<AtAGlancePayload>("/home/at-a-glance")
      .then((res) => {
        if (cancelled) return;
        if (res.data?.is_fallback && !res.data?.is_live_sql) {
          console.warn("[home] At a Glance cache used OpenAI fallback");
        }
        setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bullets = useMemo(
    () => parseBullets(data?.summary_markdown || ""),
    [data?.summary_markdown],
  );

  if (!data || bullets.length === 0) return null;

  const live = Boolean(data.is_live_sql);
  const badge = live ? "Live Ledger Metric" : minutesAgoLabel(data.created_at);

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-10" aria-label="At a Glance">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-6">
        <span
          className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            live
              ? "border border-amber-400/40 bg-amber-500/15 text-amber-200"
              : "border border-slate-600 bg-slate-800/80 text-slate-400"
          }`}
        >
          {badge}
        </span>
        <div className="mb-4 flex items-center gap-2 text-cyan-300">
          <Sparkles className="h-4 w-4" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">At a Glance</h2>
        </div>
        <ul className="space-y-2 pr-28 text-sm leading-relaxed text-slate-200">
          {bullets.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
