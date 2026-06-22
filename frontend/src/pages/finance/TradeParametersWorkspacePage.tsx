import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { TradeParametersForm } from "../../components/finance/trade-transit-hub/TradeParametersForm";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";
import {
  TRADE_TRANSIT_ROUTES,
  useTradeTransitRequest,
} from "../../contexts/TradeTransitRequestContext";

export function TradeParametersWorkspacePage() {
  const navigate = useNavigate();
  const {
    parameters,
    updateParameters,
    applyParametersToRequest,
    loadExpectedCost2026Sample,
  } = useTradeTransitRequest();

  useEffect(() => {
    if (!parameters.validityDate) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      updateParameters({ validityDate: d.toISOString().slice(0, 10) });
    }
  }, [parameters.validityDate, updateParameters]);

  function handleContinue() {
    applyParametersToRequest();
    navigate(TRADE_TRANSIT_ROUTES.productCosting);
  }

  return (
    <TradeTransitWorkspaceLayout
      title="Trade parameters workspace"
      subtitle="Capture client identity, commercial terms, forex, and routing before product costing and transit summary."
      icon={<Sparkles className="h-5 w-5 text-cyan-400" />}
    >
      <TradeParametersForm
        parameters={parameters}
        onChange={updateParameters}
        onLoadSample={loadExpectedCost2026Sample}
        onContinue={handleContinue}
      />
    </TradeTransitWorkspaceLayout>
  );
}
