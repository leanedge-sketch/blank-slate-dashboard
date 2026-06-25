import { useEffect, useRef } from "react";
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
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (searchParams.get("fresh") === "0") return;
    initialized.current = true;
    beginNewPipelineSession();
  }, [beginNewPipelineSession, searchParams]);

  return (
    <TradeTransitWorkspaceLayout
      title="New pipeline entry"
      subtitle="Manual costing workspace — customer details, multiple product lines, and the full calculator with default values you can override before saving."
      icon={<PenLine className="h-5 w-5 text-emerald-400" />}
      backHref={TRADE_TRANSIT_ROUTES.hub}
      backLabel="Back to hub"
    >
      <ImportFinanceCalculatorWorkspace
        activeSection="all"
        showRecentShipments={false}
        showNewPipelineAction={false}
      />
    </TradeTransitWorkspaceLayout>
  );
}
