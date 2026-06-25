import { useEffect, useMemo, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatNumber } from "../../utils/importFinanceCalc";
import type { TradeTransitRequest } from "../../utils/tradeTransitRequest";
import type { TradeTransitRequestSummary } from "../../utils/tradeTransitRequest";

type RequestProductLineTabsProps = {
  request: TradeTransitRequest;
  summary: TradeTransitRequestSummary;
  activeLineId: string;
  onSelectLine: (lineId: string) => void;
  onAddLine: () => void;
  onRemoveActive: () => void;
};

export function RequestProductLineTabs({
  request,
  summary,
  activeLineId,
  onSelectLine,
  onAddLine,
  onRemoveActive,
}: RequestProductLineTabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  const orderedLines = useMemo(() => {
    const active = request.lines.find((line) => line.id === activeLineId);
    const rest = request.lines.filter((line) => line.id !== activeLineId);
    return active ? [active, ...rest] : request.lines;
  }, [request.lines, activeLineId]);

  const activeLine = request.lines.find((line) => line.id === activeLineId);
  const activeResult = summary.lines.find((s) => s.lineId === activeLineId);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }, [activeLineId]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Products on this request
            </p>
            {(request.clientName || request.contactPerson || request.requestRef) && (
              <p className="mt-1 text-xs text-slate-400">
                {request.clientName || "Unnamed client"}
                {request.contactPerson ? ` · ${request.contactPerson}` : ""}
                {request.requestRef ? ` · ${request.requestRef}` : ""}
              </p>
            )}
          </div>
          <p className="text-[10px] text-slate-600 tabular-nums">
            {request.lines.length} product{request.lines.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {orderedLines.map((line) => {
            const lineResult = summary.lines.find((s) => s.lineId === line.id);
            const isActive = line.id === activeLineId;
            return (
              <button
                key={line.id}
                ref={isActive ? activeRef : undefined}
                type="button"
                onClick={() => onSelectLine(line.id)}
                className={`shrink-0 rounded-lg px-3 py-2.5 text-left text-sm border transition min-w-[140px] max-w-[220px] ${
                  isActive
                    ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-50 ring-1 ring-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "border-white/10 bg-slate-900/80 text-slate-300 hover:border-white/25 hover:bg-slate-800/80"
                }`}
              >
                <span className="font-semibold block truncate">{line.productName}</span>
                <span className="text-[10px] tabular-nums text-slate-500 mt-0.5 block">
                  {line.inputs.quantityKg.toLocaleString()} kg
                  {lineResult
                    ? ` · ${formatNumber(lineResult.result.stage3.finalLandedUnitCostEtbPerKg, 2)} ETB/kg`
                    : ""}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onAddLine}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-sm text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 transition"
          >
            <Plus className="h-4 w-4" />
            Add product
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/5">
          {activeLine && (
            <div className="flex-1 min-w-[200px] rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-500/80">
                Active selection
              </p>
              <p className="text-sm font-semibold text-cyan-100 truncate">
                {activeLine.productName}
              </p>
              <p className="text-[10px] tabular-nums text-slate-400">
                {activeLine.inputs.quantityKg.toLocaleString()} kg
                {activeResult
                  ? ` · landed ${formatNumber(activeResult.result.stage3.finalLandedUnitCostEtbPerKg, 2)} ETB/kg`
                  : ""}
              </p>
            </div>
          )}
          {request.lines.length > 1 && (
            <button
              type="button"
              onClick={onRemoveActive}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 px-3 py-2 text-sm text-rose-300/90 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="h-4 w-4" />
              Remove active
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
