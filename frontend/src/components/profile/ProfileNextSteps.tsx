import { CheckCircle2, CircleSlash, Eye } from "lucide-react";
import type { NextStepItem } from "../../utils/profileText";
import { ProfileProse } from "../ProfileProse";

const toneStyles: Record<
  NextStepItem["tone"],
  { card: string; icon: string; badge: string }
> = {
  action: {
    card: "border-emerald-200 bg-emerald-50/80",
    icon: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-800",
  },
  review: {
    card: "border-amber-200 bg-amber-50/60",
    icon: "text-amber-600",
    badge: "bg-amber-100 text-amber-800",
  },
  muted: {
    card: "border-slate-200 bg-slate-50 opacity-75",
    icon: "text-slate-400",
    badge: "bg-slate-100 text-slate-500",
  },
};

function StepIcon({ tone }: { tone: NextStepItem["tone"] }) {
  if (tone === "action") return <CheckCircle2 size={18} className={toneStyles.action.icon} />;
  if (tone === "review") return <Eye size={18} className={toneStyles.review.icon} />;
  return <CircleSlash size={18} className={toneStyles.muted.icon} />;
}

export function ProfileNextSteps({
  interactionReview,
  items,
}: {
  interactionReview: string;
  items: NextStepItem[];
}) {
  return (
    <div className="space-y-6">
      {interactionReview.trim() ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <h4 className="text-sm font-semibold text-slate-800 m-0 mb-2">Interaction review</h4>
          <ProfileProse body={interactionReview} compact />
        </div>
      ) : null}

      {items.length ? (
        <ul className="space-y-3 list-none m-0 p-0">
          {items.map((item, i) => {
            const styles = toneStyles[item.tone];
            return (
              <li
                key={`${item.index ?? i}-${item.text.slice(0, 40)}`}
                className={`flex gap-3 rounded-xl border p-4 transition-colors ${styles.card}`}
              >
                <span className="mt-0.5 shrink-0">
                  <StepIcon tone={item.tone} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {item.index != null ? (
                      <span className="text-xs font-bold text-slate-500">#{item.index}</span>
                    ) : null}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.badge}`}
                    >
                      {item.tone === "action"
                        ? "Action"
                        : item.tone === "review"
                          ? "Review"
                          : "Low priority"}
                    </span>
                  </div>
                  <p
                    className={`text-sm leading-relaxed m-0 ${
                      item.tone === "muted" ? "text-slate-500" : "text-slate-800"
                    }`}
                  >
                    {item.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ProfileProse body="No structured action items found. See full profile text in edit mode." compact />
      )}
    </div>
  );
}
