import { Calculator, PanelRightOpen } from "lucide-react";
import { ImportFinanceCalculatorWorkspace } from "../../components/finance/ImportFinanceCalculatorWorkspace";
import { useImportFinanceDock } from "../../contexts/ImportFinanceDockContext";

export function ImportFinancePage() {
  const { openDock } = useImportFinanceDock();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
      <div className="w-full bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-indigo-300">
                Import Finance
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
                <Calculator className="text-indigo-300" size={32} />
                Landed Cost Calculator
              </h1>
              <p className="text-sm text-indigo-100 max-w-2xl">
                Loads tax constants and products from Supabase. Save draft shipments to
                public.import_finance_shipments.
              </p>
            </div>
            <button
              type="button"
              onClick={openDock}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500/30"
            >
              <PanelRightOpen className="h-4 w-4" />
              Open slide-out dock
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <ImportFinanceCalculatorWorkspace />
        </div>
      </main>
    </div>
  );
}
