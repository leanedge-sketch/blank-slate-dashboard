import { Calculator, X } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "./ImportFinanceCalculatorWorkspace";

type ImportFinanceCalculatorDockProps = {
  open: boolean;
  onClose: () => void;
};

export function ImportFinanceCalculatorDock({
  open,
  onClose,
}: ImportFinanceCalculatorDockProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-6xl flex-col border-l border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="import-finance-dock-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="import-finance-dock-title"
                className="text-lg font-semibold text-slate-900"
              >
                Import Finance & Supply Chain Pipeline
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Origin → Moyale → Addis — live landed cost and margin outlook.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <ImportFinanceCalculatorWorkspace showRecentShipments={false} />
        </div>
      </aside>
    </>
  );
}
