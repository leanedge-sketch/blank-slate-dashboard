import type { TransitCostBreakdown } from "../../../../utils/transitRequestItem";
import { formatNumber } from "../../../../utils/importFinanceCalc";

type TransitSummaryExpandedRowDetailsProps = {
  breakdown: TransitCostBreakdown;
  quantity: number;
  uom: string;
  targetCurrency: string;
};

function lineAmount(
  label: string,
  perUnit: number,
  total: number,
  currency: string,
  uom: string,
) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-slate-400">{label}</span>
      <div className="text-right tabular-nums">
        <span className="text-slate-300">
          {formatNumber(perUnit, 2)} {currency}/{uom.toLowerCase()}
        </span>
        <span className="block text-[10px] text-slate-500">
          {formatNumber(total, 0)} {currency} total
        </span>
      </div>
    </div>
  );
}

export function TransitSummaryExpandedRowDetails({
  breakdown,
  quantity,
  uom,
  targetCurrency,
}: TransitSummaryExpandedRowDetailsProps) {
  const { fobPrice, freightCost, insuranceCost, customsDuty, otherLandedPerUnit } =
    breakdown;

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0B1120] px-4 py-3 sm:px-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-500/80 mb-3">
        Landed cost breakdown
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 text-xs">
        {lineAmount("FOB", fobPrice, fobPrice * quantity, targetCurrency, uom)}
        {lineAmount("Freight", freightCost, freightCost * quantity, targetCurrency, uom)}
        {lineAmount(
          "Insurance",
          insuranceCost,
          insuranceCost * quantity,
          targetCurrency,
          uom,
        )}
        {lineAmount(
          "Customs duty",
          customsDuty,
          customsDuty * quantity,
          targetCurrency,
          uom,
        )}
        {otherLandedPerUnit > 0.005
          ? lineAmount(
              "Other (bank, clearance, tax)",
              otherLandedPerUnit,
              otherLandedPerUnit * quantity,
              targetCurrency,
              uom,
            )
          : null}
      </div>
    </div>
  );
}
