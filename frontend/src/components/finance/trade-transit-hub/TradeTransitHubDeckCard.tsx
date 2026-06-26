import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export type TradeTransitDeckAccent = "blue" | "teal" | "orange" | "violet";

const accentMap: Record<
  TradeTransitDeckAccent,
  { gradient: string; accentHover: string; emoji: string }
> = {
  blue: {
    gradient: "from-blue-600 via-blue-500 to-cyan-500",
    accentHover: "group-hover:shadow-blue-500/40",
    emoji: "💼",
  },
  teal: {
    gradient: "from-emerald-600 via-emerald-500 to-teal-500",
    accentHover: "group-hover:shadow-teal-500/40",
    emoji: "📦",
  },
  orange: {
    gradient: "from-orange-600 via-orange-500 to-amber-500",
    accentHover: "group-hover:shadow-orange-500/40",
    emoji: "📋",
  },
  violet: {
    gradient: "from-violet-600 via-purple-500 to-fuchsia-500",
    accentHover: "group-hover:shadow-violet-500/40",
    emoji: "📊",
  },
};

type TradeTransitHubDeckCardProps = {
  href: string;
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
  icon: Icon,
  overline,
  title,
  description,
  buttonLabel,
  accent,
  active = false,
}: TradeTransitHubDeckCardProps) {
  const styles = accentMap[accent];

  return (
    <div
      className={`pms-module-card group relative h-full overflow-hidden rounded-2xl ${
        active ? "ring-2 ring-cyan-500/50" : ""
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800/40 via-slate-900/40 to-black/20 rounded-2xl border border-slate-700/50 transition-all duration-500 group-hover:border-slate-600 group-hover:from-slate-800/60 group-hover:via-slate-800/40 group-hover:to-slate-900/30" />

      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${styles.gradient} rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg ${styles.accentHover}`}
      />

      <div
        className={`absolute -inset-px bg-gradient-to-r ${styles.gradient} rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl`}
      />

      <div className="relative p-7 sm:p-8 flex flex-col h-full">
        <div className="flex items-center gap-4 mb-6 sm:mb-8">
          <div
            className={`inline-flex w-14 h-14 sm:w-16 sm:h-16 items-center justify-center rounded-xl bg-gradient-to-br ${styles.gradient} p-3 sm:p-4 group-hover:scale-110 transition-all duration-300 shadow-lg ${styles.accentHover}`}
          >
            <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" strokeWidth={1.5} />
          </div>
          <div className="text-3xl sm:text-4xl">{styles.emoji}</div>
        </div>

        <p className="text-xs sm:text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">
          {overline}
        </p>

        <h3 className="text-xl sm:text-2xl font-black text-white mb-3 sm:mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-cyan-300 group-hover:to-teal-300 group-hover:bg-clip-text transition-all duration-300 leading-tight">
          {title}
        </h3>

        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-7 sm:mb-10 flex-grow font-light">
          {description}
        </p>

        <Link
          to={href}
          className={`inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r ${styles.gradient} text-white font-bold text-sm sm:text-base transition-all duration-300 hover:shadow-xl ${styles.accentHover} hover:-translate-y-1 active:translate-y-0 group/btn`}
        >
          {buttonLabel}
          <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
