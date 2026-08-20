import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { useCanView } from "../../hooks/usePermissions";
import {
  MODULE_ACCESS_HINT,
  type WorkspaceModuleKey,
} from "../../lib/workspaceModules";

interface WorkspaceModuleCardProps {
  module: WorkspaceModuleKey;
  to: string;
  title: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  cta: string;
  icon: ReactNode;
  accent: string;
  hoverBorder: string;
}

export function WorkspaceModuleCard({
  module,
  to,
  title,
  eyebrow,
  description,
  bullets,
  cta,
  icon,
  accent,
  hoverBorder,
}: WorkspaceModuleCardProps) {
  const allowed = useCanView(module);

  return (
    <div
      className={`crm-feature-card-enhanced group relative overflow-hidden rounded-2xl ${
        allowed ? "" : "opacity-[0.65]"
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br from-slate-800/60 via-slate-900/40 to-black/40 rounded-2xl border border-slate-700/60 transition-all duration-500 ${
          allowed ? hoverBorder : ""
        }`}
      />
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${accent} rounded-t-2xl opacity-0 ${
          allowed ? "group-hover:opacity-100" : ""
        } transition-opacity duration-300`}
      />

      <div className="relative p-7 sm:p-8 flex flex-col h-full gap-5">
        <div className="inline-flex items-center gap-3">
          <div
            className={`inline-flex w-12 h-12 items-center justify-center rounded-xl shadow-lg ${accent.replace(
              "bg-gradient-to-r",
              "bg-gradient-to-br",
            )}`}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight flex items-center gap-2">
              {title}
              {!allowed && (
                <span title={MODULE_ACCESS_HINT[module]} aria-label="Locked">
                  🔒
                </span>
              )}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-400">{eyebrow}</p>
          </div>
        </div>

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-light">
          {description}
        </p>

        <ul className="text-slate-300 text-sm space-y-2 list-disc list-inside">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="pt-2 min-h-[52px]">
          {allowed ? (
            <Link
              to={to}
              className={`inline-flex items-center justify-center px-6 py-3 rounded-lg text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:translate-y-0 group/btn ${accent}`}
            >
              {cta}
              <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <span
              title={MODULE_ACCESS_HINT[module]}
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-400"
            >
              <Lock className="h-4 w-4" />
              {MODULE_ACCESS_HINT[module]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
