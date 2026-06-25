import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export type TradeTransitDeckAccent = "blue" | "teal" | "orange";

const accentStyles: Record<
  TradeTransitDeckAccent,
  {
    gradient: string;
    glow: string;
    iconBg: string;
    button: string;
    overline: string;
  }
> = {
  blue: {
    gradient: "from-blue-600 via-blue-500 to-cyan-500",
    glow: "group-hover:shadow-blue-500/35",
    iconBg: "bg-blue-500/20 border-blue-500/30",
    button: "bg-blue-500 hover:bg-blue-400 hover:shadow-blue-500/40",
    overline: "text-blue-400/90",
  },
  teal: {
    gradient: "from-emerald-600 via-teal-500 to-cyan-500",
    glow: "group-hover:shadow-teal-500/35",
    iconBg: "bg-teal-500/20 border-teal-500/30",
    button: "bg-teal-500 hover:bg-teal-400 hover:shadow-teal-500/40",
    overline: "text-teal-400/90",
  },
  orange: {
    gradient: "from-orange-600 via-amber-500 to-orange-400",
    glow: "group-hover:shadow-orange-500/35",
    iconBg: "bg-orange-500/20 border-orange-500/30",
    button: "bg-orange-500 hover:bg-orange-400 hover:shadow-orange-500/40",
    overline: "text-orange-400/90",
  },
};

type TradeTransitHubDeckCardProps = {
  href?: string;
  onAction?: () => void;
  icon: LucideIcon;
  overline: string;
  title: string;
  description: string;
  buttonLabel: string;
  accent: TradeTransitDeckAccent;
  active?: boolean;
};

export function TradeTransitHubDeckCard({
  href,
  onAction,
  icon: Icon,
  overline,
  title,
  description,
  buttonLabel,
  accent,
  active = false,
}: TradeTransitHubDeckCardProps) {
  const styles = accentStyles[accent];
  const buttonClass = `mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-xl ${styles.button} ${styles.glow} group/btn`;

  return (
    <article
      className={`group relative h-full overflow-hidden rounded-2xl transition-all duration-500 ${
        active ? "ring-2 ring-cyan-500/50" : ""
      }`}
    >
      <div className="absolute inset-0 rounded-2xl border border-slate-800 bg-[#111827] transition-all duration-500 group-hover:border-slate-600" />

      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${styles.gradient} rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />

      <div
        className={`absolute -inset-px bg-gradient-to-r ${styles.gradient} rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl`}
      />

      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div
          className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl border ${styles.iconBg} transition-transform duration-300 group-hover:scale-110`}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${styles.gradient}`}
          >
            <Icon className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
        </div>

        <p
          className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${styles.overline}`}
        >
          {overline}
        </p>

        <h3 className="text-xl font-black text-white mb-3 leading-tight group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-300 group-hover:bg-clip-text transition-all duration-300">
          {title}
        </h3>

        <p className="text-sm text-slate-400 leading-relaxed mb-8 flex-grow font-light">
          {description}
        </p>

        {onAction ? (
          <button type="button" onClick={onAction} className={buttonClass}>
            {buttonLabel}
            <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        ) : href ? (
          <Link to={href} className={buttonClass}>
            {buttonLabel}
            <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
