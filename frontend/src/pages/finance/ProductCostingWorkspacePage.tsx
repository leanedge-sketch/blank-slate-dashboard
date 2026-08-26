import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Package, PenLine } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";
import {
  TRADE_TRANSIT_ROUTES,
  useTradeTransitRequest,
} from "../../contexts/TradeTransitRequestContext";
import {
  parseEditProductCostingSearchParams,
  parseReturnLinkSearchParams,
} from "../../utils/pipelineEditPaths";
import { PROCUREMENT_PIPELINE_DOMAIN } from "../../lib/pipelineDomains";

export function ProductCostingWorkspacePage() {
  const [searchParams] = useSearchParams();
  const historyOnly = searchParams.get("history") === "1";
  const editPipeline = useMemo(
    () => parseEditProductCostingSearchParams(searchParams),
    [searchParams],
  );
  const returnLink = useMemo(
    () => parseReturnLinkSearchParams(searchParams),
    [searchParams],
  );
  const isEditMode = editPipeline != null;
  const {
    applyParametersToRequest,
    autosaveSavedAt,
    autosaveRestored,
    restoreAutosaveDraft,
    discardAutosaveDraft,
    setAutosaveEnabled,
  } = useTradeTransitRequest();

  const [draftPromptOpen, setDraftPromptOpen] = useState(false);

  useEffect(() => {
    if (!historyOnly && !isEditMode) {
      applyParametersToRequest();
    }
  }, [applyParametersToRequest, historyOnly, isEditMode]);

  useEffect(() => {
    // Phase 1 prompt only for the non-history, non-edit procurement wizard views.
    if (historyOnly || isEditMode) return;
    const shouldPrompt = Boolean(autosaveSavedAt) && !autosaveRestored;
    if (!shouldPrompt) return;
    setAutosaveEnabled(false);
    setDraftPromptOpen(true);
  }, [autosaveSavedAt, autosaveRestored, historyOnly, isEditMode, setAutosaveEnabled]);

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
      backHref={returnLink?.returnTo || TRADE_TRANSIT_ROUTES.hub}
      backLabel={returnLink?.returnLabel || "Back to Hub"}
    >
      <ImportFinanceCalculatorWorkspace
        activeSection="products"
        historyOnly={historyOnly}
        showRecentShipments
        showProcurementLineAction={!isEditMode}
        showCustomerFields={false}
        editPipeline={editPipeline}
        pipelineDomain={PROCUREMENT_PIPELINE_DOMAIN}
      />

      {draftPromptOpen && autosaveSavedAt ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/90 p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Unsaved costing draft detected
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              You have an unsaved costing draft from{" "}
              {new Date(autosaveSavedAt).toLocaleString()}. Resume Draft or
              Discard.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  restoreAutosaveDraft();
                  setDraftPromptOpen(false);
                  setAutosaveEnabled(true);
                }}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 transition"
              >
                Resume Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  discardAutosaveDraft();
                  setDraftPromptOpen(false);
                  setAutosaveEnabled(true);
                }}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </TradeTransitWorkspaceLayout>
  );
}
