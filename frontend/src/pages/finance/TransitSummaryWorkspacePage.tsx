import { useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";
import { useTradeTransitRequest } from "../../contexts/TradeTransitRequestContext";
import { PROCUREMENT_PIPELINE_DOMAIN } from "../../lib/pipelineDomains";

export function TransitSummaryWorkspacePage() {
  const { applyParametersToRequest, parameters } = useTradeTransitRequest();

  useEffect(() => {
    applyParametersToRequest();
  }, [applyParametersToRequest]);

  return (
    <TradeTransitWorkspaceLayout
      title="Transit summary"
      subtitle={`Procurement accounting for ${parameters.clientName.trim() || "unnamed client"} — separate from CRM sales deals.`}
      icon={<ClipboardList className="h-5 w-5 text-orange-400" />}
    >
      <ImportFinanceCalculatorWorkspace
        activeSection="summary"
        showRecentShipments={false}
        pipelineDomain={PROCUREMENT_PIPELINE_DOMAIN}
      />
    </TradeTransitWorkspaceLayout>
  );
}
