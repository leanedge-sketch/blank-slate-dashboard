import { CircleSlash, Sparkles } from "lucide-react";
import {
  sortCategoryRecommendationsByScore,
  type CategoryRecommendation,
} from "../../utils/profileText";
import { ProfileProse } from "../ProfileProse";

const toneStyles: Record<
  CategoryRecommendation["tone"],
  { card: string; badge: string; action: string }
> = {
  action: {
    card: "border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/90 shadow-sm",
    badge: "bg-emerald-600 text-white",
    action: "text-slate-900 font-bold",
  },
  review: {
    card: "border-amber-200 bg-amber-50/70",
    badge: "bg-amber-100 text-amber-800",
    action: "text-slate-800 font-semibold",
  },
  muted: {
    card: "border-slate-200 bg-slate-50/60",
    badge: "bg-slate-100 text-slate-500",
    action: "text-slate-400 font-normal",
  },
};

export function ProfileNextSteps({
  interactionReview,
  categories,
}: {
  interactionReview: string;
  categories: CategoryRecommendation[];
}) {
  const sortedCategories = sortCategoryRecommendationsByScore(categories);
  const hasCategories = sortedCategories.some(
    (c) => c.analysis.trim() || c.action.trim(),
  );

  return (
    <div className="space-y-6">
      {interactionReview.trim() ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <h4 className="text-sm font-semibold text-slate-800 m-0 mb-2">
            Interaction review
          </h4>
          <ProfileProse body={interactionReview} compact />
        </div>
      ) : null}

      {hasCategories ? (
        <ul className="space-y-4 list-none m-0 p-0">
          {sortedCategories.map((item) => {
            const styles = toneStyles[item.tone];
            const isPrimary = item.tone === "action";

            return (
              <li
                key={item.category}
                className={`rounded-xl border p-4 sm:p-5 ${styles.card}`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h4 className="text-sm font-extrabold text-slate-900 m-0 tracking-tight">
                    {item.category}
                  </h4>
                  {item.score != null ? (
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                      {item.score}/3 fit
                    </span>
                  ) : null}
                  {isPrimary ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}
                    >
                      <Sparkles size={11} aria-hidden />
                      Primary Action
                    </span>
                  ) : item.tone === "muted" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <CircleSlash size={14} aria-hidden />
                      Low priority
                    </span>
                  ) : null}
                </div>

                <p className="text-sm text-slate-600 leading-relaxed m-0 mb-2">
                  <span className="font-semibold text-slate-700">Analysis: </span>
                  {item.analysis}
                </p>

                <p className={`text-sm leading-relaxed m-0 ${styles.action}`}>
                  <span
                    className={
                      isPrimary
                        ? "font-bold text-emerald-800"
                        : "font-semibold text-slate-600"
                    }
                  >
                    Next step:{" "}
                  </span>
                  {item.action}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <ProfileProse
          body="No structured category actions found. Regenerate the ICP profile for Cement, Dry-Mix, Admixtures, and Paint & Coatings bullets."
          compact
        />
      )}
    </div>
  );
}
