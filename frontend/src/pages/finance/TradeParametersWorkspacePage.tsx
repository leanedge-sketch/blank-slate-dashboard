import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { TradeParametersForm } from "../../components/finance/trade-transit-hub/TradeParametersForm";
import { ProcurementPipelineActions } from "../../components/finance/trade-transit-hub/ProcurementPipelineActions";
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
    autosaveSavedAt,
    autosaveRestored,
    restoreAutosaveDraft,
    discardAutosaveDraft,
    setAutosaveEnabled,
  } = useTradeTransitRequest();

  const [draftPromptOpen, setDraftPromptOpen] = useState(false);

  useEffect(() => {
    const shouldPrompt = Boolean(autosaveSavedAt) && !autosaveRestored;
    if (!shouldPrompt) return;

    // Freeze autosave while the user decides.
    setAutosaveEnabled(false);
    setDraftPromptOpen(true);
  }, [autosaveSavedAt, autosaveRestored, setAutosaveEnabled]);

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
      actions={<ProcurementPipelineActions />}
    >
      <TradeParametersForm
        parameters={parameters}
        onChange={updateParameters}
        onLoadSample={loadExpectedCost2026Sample}
        onContinue={handleContinue}
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
