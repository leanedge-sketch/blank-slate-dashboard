import { PanelRightOpen } from "lucide-react";
import { TradeTransitHubDecks } from "../../components/finance/trade-transit-hub/TradeTransitHubDecks";
import { TradeTransitConnectedModules } from "../../components/finance/trade-transit-hub/TradeTransitConnectedModules";
import { TradeTransitHubHero } from "../../components/finance/trade-transit-hub/TradeTransitHubHero";
import { TRADE_TRANSIT_ROUTES } from "../../contexts/TradeTransitRequestContext";
import { useImportFinanceDock } from "../../contexts/ImportFinanceDockContext";

export function ImportFinancePage() {
  const { openDock } = useImportFinanceDock();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-600/12 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 left-0 w-72 h-72 bg-orange-600/8 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      </div>

      <div className="relative z-10">
        <div className="border-b border-slate-800/60 bg-slate-950/50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-end">
            <button
              type="button"
              onClick={openDock}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition"
            >
              <PanelRightOpen className="h-4 w-4" />
              Slide-out dock
            </button>
          </div>
        </div>

        <TradeTransitHubHero
          newRequestHref={TRADE_TRANSIT_ROUTES.tradeParameters}
          historyHref={`${TRADE_TRANSIT_ROUTES.productCosting}?history=1`}
        />

        <TradeTransitHubDecks />

        <TradeTransitConnectedModules />
      </div>
    </div>
  );
}
