import { Link } from "react-router-dom";
import { ChevronLeft, DollarSign } from "lucide-react";
import { PricingCostingView } from "../../components/pms/pricing-costing/PricingCostingView";

export function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      <div className="w-full shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link
                to="/pms"
                className="text-slate-400 transition-colors hover:text-slate-200"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                PMS · Pricing &amp; Costing
              </p>
            </div>
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              <DollarSign className="text-orange-400" size={28} />
              Pricing &amp; Costing
            </h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Master–detail view: select a partner, then review incoterm pricing by
              location with explicit cost and price currencies.
            </p>
          </div>
        </main>
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="min-h-0 flex-1 h-[calc(100vh-11.5rem)] max-h-[900px]">
          <PricingCostingView />
        </div>
      </main>
    </div>
  );
}
