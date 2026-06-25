import { ArrowRight, Container, History, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { openNewPipelineWindow } from "../../../utils/newPipelineSession";

type TradeTransitHubHeroProps = {
  historyHref: string;
};

export function TradeTransitHubHero({ historyHref }: TradeTransitHubHeroProps) {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-8 sm:pb-10">
      <div className="max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/15 to-teal-500/15 border border-cyan-400/30 mb-8 backdrop-blur-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
          </span>
          <span className="text-xs sm:text-sm font-semibold bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">
            Logistics &amp; Import Finance
          </span>
        </div>

        <div className="space-y-6 sm:space-y-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            <span className="block">Trade and Transit</span>
            <span className="block bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
              Hub
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed font-light">
            Manage your logistics, calculate trade costs, and view comprehensive
            transit summaries—all in one streamlined workspace.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              type="button"
              onClick={openNewPipelineWindow}
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold text-base sm:text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/30 hover:-translate-y-0.5 active:translate-y-0 group"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add new pipeline
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
            <Link
              to={historyHref}
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl border-2 border-slate-700 text-white font-bold text-base sm:text-lg transition-all duration-300 hover:border-slate-500 hover:bg-slate-800/40 backdrop-blur-sm group"
            >
              <History className="w-5 h-5 mr-2 text-slate-400 group-hover:text-cyan-300 transition-colors" />
              View History
            </Link>
          </div>

          <div className="flex items-center gap-3 pt-2 text-slate-500 text-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Container className="h-4 w-4 text-cyan-400" />
            </span>
            <span>Dual-FX customs waterfall · multi-product client requests</span>
          </div>
        </div>
      </div>
    </section>
  );
}
