import { ChevronRight } from "lucide-react";
import { formatEtb, formatNumber } from "../../../../utils/importFinanceCalc";
import type { TransitRequestItem } from "../../../../utils/transitRequestItem";
import { TransitSummaryExpandedRowDetails } from "./TransitSummaryExpandedRowDetails";

function marginTone(marginPct: number): string {
  if (marginPct < 15) {
    return "text-amber-400 font-semibold drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]";
  }
  return "text-emerald-400 font-semibold drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]";
}

type TransitSummaryTableRowProps = {
  item: TransitRequestItem;
  expanded: boolean;
  onToggle: () => void;
};

export function TransitSummaryTableRow({
  item,
  expanded,
  onToggle,
}: TransitSummaryTableRowProps) {
  const qtyLabel = `${item.quantity.toLocaleString()} ${item.uom}`;

  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="border-b border-white/5 text-slate-300 hover:bg-white/[0.03] transition-colors cursor-pointer"
      >
        <td className="py-2.5 pr-2 pl-1">
          <div className="flex items-center gap-2 min-w-[120px]">
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${
                expanded ? "rotate-90 text-cyan-400" : ""
              }`}
            />
            <span className="font-medium text-slate-100">{item.productName}</span>
          </div>
        </td>
        <td className="py-2.5 pr-2 text-right tabular-nums text-slate-400 text-[11px] sm:text-xs whitespace-nowrap">
          {qtyLabel}
        </td>
        <td className="py-2.5 pr-2 text-right tabular-nums font-medium text-emerald-400 text-[11px] sm:text-xs">
          {formatNumber(item.landedPerUnit, 2)}
        </td>
        <td className="py-2.5 pr-2 text-right tabular-nums text-slate-300 text-[11px] sm:text-xs">
          {formatEtb(item.totalCost, 0)}
        </td>
        <td className="py-2.5 pr-2 text-right tabular-nums text-slate-300 text-[11px] sm:text-xs">
          {formatNumber(item.sellingPerUnit, 2)}
        </td>
        <td className="py-2.5 pr-2 text-right tabular-nums text-slate-300 text-[11px] sm:text-xs">
          {formatNumber(item.profitPerUnit, 2)}
        </td>
        <td
          className={`py-2.5 pr-2 text-right tabular-nums text-[11px] sm:text-xs ${marginTone(item.marginPct)}`}
        >
          {formatNumber(item.marginPct, 1)}%
        </td>
        <td className="py-2.5 pr-1 text-right tabular-nums text-slate-200 text-[11px] sm:text-xs">
          <div className="flex flex-col items-end gap-0.5">
            <span>{formatEtb(item.revenue, 0)}</span>
            {!item.financial.isVatInclusive && (
              <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500 rounded px-1.5 py-0.5 border border-slate-700/80">
                ex. VAT
              </span>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/5 bg-[#0B1120]/60">
          <td colSpan={8} className="px-3 py-3 sm:px-4">
            <TransitSummaryExpandedRowDetails
              breakdown={item.costBreakdown}
              quantity={item.quantity}
              uom={item.uom}
              targetCurrency={item.financial.targetCurrency}
            />
          </td>
        </tr>
      )}
    </>
  );
}
