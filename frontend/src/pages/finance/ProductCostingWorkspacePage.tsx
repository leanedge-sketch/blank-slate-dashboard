import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Package } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";
import {
  TRADE_TRANSIT_ROUTES,
  useTradeTransitRequest,
} from "../../contexts/TradeTransitRequestContext";

export function ProductCostingWorkspacePage() {
  const [searchParams] = useSearchParams();
  const historyOnly = searchParams.get("history") === "1";
  const { applyParametersToRequest, parameters } = useTradeTransitRequest();

  useEffect(() => {
    if (!historyOnly) {
      applyParametersToRequest();
    }
  }, [applyParametersToRequest, historyOnly]);

  return (
    <TradeTransitWorkspaceLayout
      title={historyOnly ? "Saved pipeline history" : "Product costing workspace"}
      subtitle={
        historyOnly
          ? "Review and reload saved shipment snapshots."
          : `Product lines, landed cost, and margins for ${parameters.clientName.trim() || "your client"}.`
      }
      icon={<Package className="h-5 w-5 text-teal-400" />}
      actions={
        !historyOnly ? (
          <Link
            to={TRADE_TRANSIT_ROUTES.transitSummary}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-200 hover:bg-orange-500/20 transition"
          >
            View transit summary
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : undefined
      }
    >
      <ImportFinanceCalculatorWorkspace
        activeSection="products"
        historyOnly={historyOnly}
        showRecentShipments
      />
    </TradeTransitWorkspaceLayout>
  );
}
