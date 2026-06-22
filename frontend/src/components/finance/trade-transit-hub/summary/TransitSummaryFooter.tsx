import { formatEtb } from "../../../../utils/importFinanceCalc";
import type { TransitRequestFinancialTotals } from "../../../../utils/transitRequestItem";

type TransitSummaryFooterProps = {
  totals: TransitRequestFinancialTotals;
  customsPaidEtb?: number;
};

function profitTone(netProfit: number): string {
  if (netProfit < 0) {
    return "text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.4)]";
  }
  return "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]";
}

export function TransitSummaryFooter({
  totals,
  customsPaidEtb,
}: TransitSummaryFooterProps) {
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-800 bg-[#0B1120] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Total cost
          </p>
          <p className="text-lg font-black tabular-nums text-white">
            {formatEtb(totals.totalCost, 0)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 tabular-nums">
            Base + customs + freight
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0B1120] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Total revenue
          </p>
          <p className="text-lg font-black tabular-nums text-white">
            {formatEtb(totals.totalRevenue, 0)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">Gross revenue (ex. VAT)</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0B1120] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Net profit
          </p>
          <p
            className={`text-lg font-black tabular-nums ${profitTone(totals.netProfit)}`}
          >
            {formatEtb(totals.netProfit, 0)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 tabular-nums">
            Revenue − total cost
          </p>
        </div>
      </div>
      {customsPaidEtb != null && (
        <p className="mt-3 text-[10px] sm:text-xs text-slate-500 tabular-nums">
          Combined landed investment {formatEtb(totals.totalCost, 0)} · customs{" "}
          {formatEtb(customsPaidEtb, 0)}
        </p>
      )}
    </div>
  );
}
