import { Container, X } from "lucide-react";
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
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-6xl flex-col border-l border-white/10 bg-slate-950 text-slate-100 shadow-2xl shadow-cyan-500/5"
        role="dialog"
        aria-labelledby="import-finance-dock-title"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4 bg-slate-950/90 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/25 p-2 text-cyan-400">
              <Container className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/70">
                Trade &amp; Transit
              </p>
              <h2
                id="import-finance-dock-title"
                className="text-lg font-semibold text-white"
              >
                Procurement Pipeline
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Origin → Moyale → Addis — live landed cost &amp; margin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300"
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
