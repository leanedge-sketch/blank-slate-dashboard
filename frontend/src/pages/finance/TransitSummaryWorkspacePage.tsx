import { useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";
import { useTradeTransitRequest } from "../../contexts/TradeTransitRequestContext";

export function TransitSummaryWorkspacePage() {
  const { applyParametersToRequest, parameters } = useTradeTransitRequest();

  useEffect(() => {
    applyParametersToRequest();
  }, [applyParametersToRequest]);

  return (
    <TradeTransitWorkspaceLayout
      title="Transit summary"
      subtitle={`Accounting breakdown for ${parameters.clientName.trim() || "unnamed client"} — quantities, landed rates, margins, and revenue.`}
      icon={<ClipboardList className="h-5 w-5 text-orange-400" />}
    >
      <ImportFinanceCalculatorWorkspace
        activeSection="summary"
        showRecentShipments={false}
      />
    </TradeTransitWorkspaceLayout>
  );
}
