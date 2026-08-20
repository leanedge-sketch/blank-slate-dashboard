import { useEffect, useState } from "react";
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
import { fetchSalesPipelineById } from "../../services/api";
import { loadTradeTransitAutosave } from "../../utils/tradeTransitAutosave";

/** Import costing workspace linked to a CRM sales deal (saved separately from procurement). */
export function SalesCostingWorkspacePage() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const {
    beginNewPipelineSession,
    updateParameters,
    applyParametersToRequest,
    restoreAutosaveDraft,
    setAutosaveEnabled,
    clearAutosave,
  } = useTradeTransitRequest();

  const [dealLoadError, setDealLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!pipelineId) return;

    let cancelled = false;
    setDealLoadError(null);
    void (async () => {
      try {
        await fetchSalesPipelineById(pipelineId);
      } catch (err) {
        if (!cancelled) {
          setDealLoadError(
            err instanceof Error ? err.message : "Linked sales deal missing.",
          );
        }
      }
    })();

    const draft = loadTradeTransitAutosave();
    const isSalesDraft =
      Boolean(draft?.request?.requestRef?.startsWith("SALES-")) ?? false;

    if (isSalesDraft) {
      // Preserve calculated parameters across navigation.
      restoreAutosaveDraft();
      setAutosaveEnabled(true);
      return;
    }

    // Start a fresh standalone sales-costing draft, but don't delete the
    // existing local draft unless the user is explicitly resuming/discarding.
    if (draft) {
      // Avoid the procurement draft "freeze" guard so we can autosave this
      // sales session deterministically.
      clearAutosave();
    }
    beginNewPipelineSession({ clearAutosave: false });
    updateParameters({
      requestDate: todayIsoDate(),
      requestRef: generatePipelineRequestRef(todayIsoDate(), "SALES"),
    });
    applyParametersToRequest();
    setAutosaveEnabled(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per visit
  }, [pipelineId]);

  return (
    <TradeTransitWorkspaceLayout
      title="Sales deal costing"
      subtitle="Import costing for this CRM sales deal — saved separately from procurement pipelines."
      icon={<Calculator className="h-5 w-5 text-violet-400" />}
      backHref={pipelineId ? `/sales/pipeline/${pipelineId}` : TRADE_TRANSIT_ROUTES.hub}
      backLabel={pipelineId ? `Return to Sales Deal #${pipelineId}` : "Back to hub"}
    >
      {dealLoadError && pipelineId ? (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Linked Sales Deal #{pipelineId} was archived or deleted. Costing calculations
          are in standalone mode.
        </div>
      ) : null}
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
