import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Package, PenLine } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";
import {
  TRADE_TRANSIT_ROUTES,
  useTradeTransitRequest,
} from "../../contexts/TradeTransitRequestContext";
import { parseEditProductCostingSearchParams } from "../../utils/pipelineEditPaths";

export function ProductCostingWorkspacePage() {
  const [searchParams] = useSearchParams();
  const historyOnly = searchParams.get("history") === "1";
  const editPipeline = useMemo(
    () => parseEditProductCostingSearchParams(searchParams),
    [searchParams],
  );
  const isEditMode = editPipeline != null;
  const { applyParametersToRequest } = useTradeTransitRequest();

  useEffect(() => {
    if (!historyOnly && !isEditMode) {
      applyParametersToRequest();
    }
  }, [applyParametersToRequest, historyOnly, isEditMode]);

  const title = historyOnly
    ? "Saved pipeline history"
    : isEditMode
      ? "Edit product costing"
      : "Product costing workspace";

  const subtitle = historyOnly
    ? "Open a saved request to edit product lines in the costing workspace."
    : isEditMode
      ? `Pipeline ${editPipeline.requestRef} — loaded from your last save. Update lines and save again.`
      : "Add a pipeline to start a new customer request, or edit a saved pipeline from history below.";

  return (
    <TradeTransitWorkspaceLayout
      title={title}
      subtitle={subtitle}
      icon={
        isEditMode ? (
          <PenLine className="h-5 w-5 text-teal-400" />
        ) : (
          <Package className="h-5 w-5 text-teal-400" />
        )
      }
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
        showProcurementLineAction={!isEditMode}
        showCustomerFields={false}
        editPipeline={editPipeline}
      />
    </TradeTransitWorkspaceLayout>
  );
}
