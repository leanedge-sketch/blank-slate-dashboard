import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PenLine } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";
import {
  TRADE_TRANSIT_ROUTES,
  useTradeTransitRequest,
} from "../../contexts/TradeTransitRequestContext";

export function NewPipelineWorkspacePage() {
  const [searchParams] = useSearchParams();
  const { beginNewPipelineSession } = useTradeTransitRequest();

  useEffect(() => {
    if (searchParams.get("fresh") === "0") return;
    beginNewPipelineSession();
    // Reset only when this tab/window first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TradeTransitWorkspaceLayout
      title="Procurement pipeline"
      subtitle="Fill in the customer request, then add product lines. Tax rates, transport, and customs reference use defaults — enter quantity and supplier price for each line."
      icon={<PenLine className="h-5 w-5 text-emerald-400" />}
      backHref={TRADE_TRANSIT_ROUTES.hub}
      backLabel="Back to hub"
    >
      <ImportFinanceCalculatorWorkspace
        activeSection="all"
        showRecentShipments={false}
        showProcurementLineAction={false}
        showCustomerFields
        blankNewLines
      />
    </TradeTransitWorkspaceLayout>
  );
}
