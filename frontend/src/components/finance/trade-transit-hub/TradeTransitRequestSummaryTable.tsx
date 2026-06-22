import { formatEtb, formatNumber } from "../../../utils/importFinanceCalc";
import type { TradeTransitRequest } from "../../../utils/tradeTransitRequest";
import type { TradeTransitRequestSummary } from "../../../utils/tradeTransitRequest";

type TradeTransitRequestSummaryTableProps = {
  clientName: string;
  request: TradeTransitRequest;
  summary: TradeTransitRequestSummary;
  className?: string;
};

export function TradeTransitRequestSummaryTable({
  clientName,
  request,
  summary,
  className = "",
}: TradeTransitRequestSummaryTableProps) {
  const label = clientName.trim() || "Unnamed client";

  return (
    <div
      className={`rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4 sm:px-5 sm:py-5 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/90 mb-3">
        Request summary — {label}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs sm:text-sm text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/10">
              <th className="py-2.5 pr-3 font-semibold">Product</th>
              <th className="py-2.5 pr-3 font-semibold text-right">Qty</th>
              <th className="py-2.5 pr-3 font-semibold text-right">Landed/kg</th>
              <th className="py-2.5 pr-3 font-semibold text-right">Selling/kg</th>
              <th className="py-2.5 pr-3 font-semibold text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {summary.lines.map(({ lineId, productName, result }) => (
              <tr
                key={lineId}
                className="border-b border-white/5 text-slate-300 hover:bg-white/[0.02] transition-colors"
              >
                <td className="py-2.5 pr-3 font-medium text-slate-200">
                  {productName}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                  {request.lines
                    .find((l) => l.id === lineId)
                    ?.inputs.quantityKg.toLocaleString()}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-emerald-400">
                  {formatNumber(result.stage3.finalLandedUnitCostEtbPerKg, 2)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">
                  {formatNumber(result.stage4.targetSellingPriceEtbPerKg, 2)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">
                  {formatEtb(result.stage4.totalExpectedRevenueEtb, 0)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-white/10 bg-white/[0.03]">
              <td className="py-3 pr-3 font-bold text-white">Total</td>
              <td className="py-3 pr-3 text-right tabular-nums font-bold text-white">
                {summary.totals.quantityKg.toLocaleString()}
              </td>
              <td className="py-3 pr-3 text-right text-slate-500">—</td>
              <td className="py-3 pr-3 text-right text-slate-500">—</td>
              <td className="py-3 pr-3 text-right tabular-nums font-bold text-white">
                {formatEtb(summary.totals.expectedRevenueEtb, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] sm:text-xs text-slate-500 tabular-nums">
        Combined landed investment {formatEtb(summary.totals.landedCostEtb, 0)} ·
        customs {formatEtb(summary.totals.customsPaidEtb, 0)}
      </p>
    </div>
  );
}
