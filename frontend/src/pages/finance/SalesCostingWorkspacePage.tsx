import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Calculator } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";
import {
  TRADE_TRANSIT_ROUTES,
  useTradeTransitRequest,
} from "../../contexts/TradeTransitRequestContext";
import { SALES_PIPELINE_DOMAIN } from "../../lib/pipelineDomains";
import { generatePipelineRequestRef, todayIsoDate } from "../../types/tradeParameters";

/** Import costing workspace linked to a CRM sales deal (saved separately from procurement). */
export function SalesCostingWorkspacePage() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const { beginNewPipelineSession, updateParameters, applyParametersToRequest } =
    useTradeTransitRequest();

  useEffect(() => {
    beginNewPipelineSession();
    updateParameters({
      requestDate: todayIsoDate(),
      requestRef: generatePipelineRequestRef(todayIsoDate(), "SALES"),
    });
    applyParametersToRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per visit
  }, [pipelineId]);

  return (
    <TradeTransitWorkspaceLayout
      title="Sales deal costing"
      subtitle="Import costing for this CRM sales deal — saved separately from procurement pipelines."
      icon={<Calculator className="h-5 w-5 text-violet-400" />}
      backHref={pipelineId ? `/sales/pipeline/${pipelineId}` : TRADE_TRANSIT_ROUTES.hub}
      backLabel={pipelineId ? "Back to sales deal" : "Back to hub"}
    >
      <ImportFinanceCalculatorWorkspace
        activeSection="all"
        showRecentShipments={false}
        showProcurementLineAction={false}
        showCustomerFields
        blankNewLines
        pipelineDomain={SALES_PIPELINE_DOMAIN}
        salesPipelineId={pipelineId ?? null}
        navigateToProductCostingOnSave
      />
    </TradeTransitWorkspaceLayout>
  );
}
