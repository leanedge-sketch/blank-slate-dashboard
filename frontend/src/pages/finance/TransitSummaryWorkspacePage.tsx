import { useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { ProcurementPipelineActions } from "../../components/finance/trade-transit-hub/ProcurementPipelineActions";
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
      subtitle={
        parameters.clientName.trim()
          ? `${parameters.clientName.trim()}${parameters.contactPerson.trim() ? ` · ${parameters.contactPerson.trim()}` : ""}${parameters.requestRef.trim() ? ` · ${parameters.requestRef.trim()}` : ""}`
          : "Saved procurement requests with company, contact, and request ID."
      }
      icon={<ClipboardList className="h-5 w-5 text-orange-400" />}
      actions={<ProcurementPipelineActions />}
    >
      <ImportFinanceCalculatorWorkspace
        activeSection="summary"
        showRecentShipments={false}
        pipelineDomain={PROCUREMENT_PIPELINE_DOMAIN}
      />
    </TradeTransitWorkspaceLayout>
  );
}
