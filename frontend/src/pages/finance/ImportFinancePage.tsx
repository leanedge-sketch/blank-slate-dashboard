import { Container, PanelRightOpen } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { useImportFinanceDock } from "../../contexts/ImportFinanceDockContext";

export function ImportFinancePage() {
  const { openDock } = useImportFinanceDock();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
      </div>

      <div className="relative z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-500/80">
                Trade &amp; Transit
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-3 text-white">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/25">
                  <Container className="text-cyan-400" size={24} />
                </span>
                Procurement Pipeline
              </h1>
              <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
                Simulate global supply chain costs from origin through Moyale
                customs to the Addis Ababa warehouse. Live margin outlook against
                your target selling price.
              </p>
            </div>
            <button
              type="button"
              onClick={openDock}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-500/40 hover:text-cyan-300 transition"
            >
              <PanelRightOpen className="h-4 w-4" />
              Slide-out dock
            </button>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <ImportFinanceCalculatorWorkspace />
      </main>
    </div>
  );
}
