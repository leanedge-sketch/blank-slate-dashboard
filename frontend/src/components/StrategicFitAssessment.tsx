import { useMemo, useState } from "react";
import type { StrategicFitItem } from "../utils/profileText";
import {
  mergeStrategicFitAssessmentItems,
  splitStrategicFitVisibility,
} from "../utils/strategicFitAssessment";

function scoreBadgeClasses(score: number): string {
  if (score <= 0) {
    return "bg-slate-200 text-slate-500";
  }
  if (score >= 3) {
    return "bg-emerald-600 text-white";
  }
  if (score === 2) {
    return "bg-blue-600 text-white";
  }
  return "bg-amber-500 text-white";
}

function FitScoreRow({ item }: { item: StrategicFitItem }) {
  const active = item.score > 0;

  return (
    <div
      className={
        active
          ? "flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-start sm:gap-4"
          : "flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
      }
    >
      <span
        className={
          active
            ? "min-w-[9rem] shrink-0 text-sm font-bold text-slate-900 sm:text-base"
            : "min-w-[9rem] shrink-0 text-sm font-medium text-slate-400 sm:text-base"
        }
      >
        {item.category}
      </span>

      <span
        className={`inline-flex w-fit shrink-0 items-center justify-center rounded-full px-3 py-1 text-sm font-bold tabular-nums ${scoreBadgeClasses(item.score)}`}
      >
        {item.score}/3
      </span>

      {item.reason ? (
        <p
          className={
            active
              ? "flex-1 text-sm leading-relaxed text-slate-600"
              : "flex-1 text-sm leading-relaxed text-slate-400"
          }
        >
          {item.reason}
        </p>
      ) : (
        <span className="flex-1 text-sm italic text-slate-400">No rationale provided</span>
      )}
    </div>
  );
}

function FitScoreList({ items }: { items: StrategicFitItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <FitScoreRow key={item.category} item={item} />
      ))}
    </div>
  );
}

export function StrategicFitAssessment({ items }: { items: StrategicFitItem[] }) {
  const [expanded, setExpanded] = useState(false);

  const merged = useMemo(
    () => mergeStrategicFitAssessmentItems(items),
    [items],
  );

  const { visible, hidden } = useMemo(
    () => splitStrategicFitVisibility(merged),
    [merged],
  );

  if (!merged.length) return null;

  return (
    <div className="flex flex-col gap-4">
      <FitScoreList items={visible} />

      {hidden.length > 0 ? (
        <div className="flex flex-col gap-3">
          {expanded ? <FitScoreList items={hidden} /> : null}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            {expanded
              ? "Read Less"
              : `Read More (${hidden.length} more ${hidden.length === 1 ? "category" : "categories"})`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
