import { Link } from "react-router-dom";
import { ArrowRight, Container } from "lucide-react";

type TradeTransitDeckCardProps = {
  to?: string;
  className?: string;
};

export function TradeTransitDeckCard({
  to = "/finance/import",
  className = "",
}: TradeTransitDeckCardProps) {
  return (
    <Link
      to={to}
      className={`group block rounded-xl bg-slate-900 border border-white/10 p-6 transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Container className="h-6 w-6 text-cyan-400" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80 mb-1">
              Trade &amp; Transit
            </p>
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-50 transition-colors">
              Procurement Pipeline
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Simulate global supply chain costs, calculate customs waterfalls, and
              project local warehouse margins.
            </p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all mt-1" />
      </div>
    </Link>
  );
}
