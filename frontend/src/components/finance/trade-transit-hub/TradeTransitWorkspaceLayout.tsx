import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { TRADE_TRANSIT_ROUTES } from "../../../contexts/TradeTransitRequestContext";

type TradeTransitWorkspaceLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function TradeTransitWorkspaceLayout({
  children,
  title,
  subtitle,
  icon,
  backHref = TRADE_TRANSIT_ROUTES.hub,
  backLabel = "Back to Hub",
  actions,
}: TradeTransitWorkspaceLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <Link
            to={backHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          {actions}
        </div>

        <header className="mb-8 sm:mb-10">
          <div className="flex items-center gap-3 mb-3">
            {icon}
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-500/90">
              {title}
            </p>
          </div>
          {subtitle ? (
            <p className="text-sm sm:text-base text-slate-400 max-w-3xl font-light leading-relaxed">
              {subtitle}
            </p>
          ) : null}
        </header>

        {children}
      </div>
    </div>
  );
}
