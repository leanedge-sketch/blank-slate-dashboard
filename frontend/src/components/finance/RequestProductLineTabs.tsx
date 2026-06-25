import { useEffect, useMemo, useRef } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatNumber } from "../../utils/importFinanceCalc";
import type { TradeTransitRequest } from "../../utils/tradeTransitRequest";
import type { TradeTransitRequestSummary } from "../../utils/tradeTransitRequest";

function lineTabLabel(name: string, index: number): string {
  const trimmed = name.trim();
  return trimmed || `Line ${index + 1}`;
}

type RequestProductLineTabsProps = {
  request: TradeTransitRequest;
  summary: TradeTransitRequestSummary;
  activeLineId: string;
  renamingLineId?: string | null;
  onSelectLine: (lineId: string) => void;
  onAddLine: () => void;
  onRemoveActive: () => void;
  onRenameLine: (lineId: string, productName: string) => void;
  onRenamingLineIdChange?: (lineId: string | null) => void;
  showRequestHeader?: boolean;
};

export function RequestProductLineTabs({
  request,
  summary,
  activeLineId,
  renamingLineId = null,
  onSelectLine,
  onAddLine,
  onRemoveActive,
  onRenameLine,
  onRenamingLineIdChange,
  showRequestHeader = true,
}: RequestProductLineTabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const orderedLines = useMemo(() => {
    const active = request.lines.find((line) => line.id === activeLineId);
    const rest = request.lines.filter((line) => line.id !== activeLineId);
    return active ? [active, ...rest] : request.lines;
  }, [request.lines, activeLineId]);

  const activeLine = request.lines.find((line) => line.id === activeLineId);
  const renamingLine = request.lines.find((line) => line.id === renamingLineId);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }, [activeLineId]);

  useEffect(() => {
    if (renamingLineId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingLineId]);

  function finishRename(lineId: string, value: string) {
    onRenameLine(lineId, value.trim());
    onRenamingLineIdChange?.(null);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Product lines
            </p>
            {showRequestHeader ? (
              <p className="mt-1 text-xs text-slate-400">
                Each tab is one product on the same customer request.
              </p>
            ) : null}
          </div>
          <p className="text-[10px] text-slate-600 tabular-nums">
            {request.lines.length} product{request.lines.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {orderedLines.map((line) => {
            const lineIndex = request.lines.findIndex((l) => l.id === line.id);
            const lineResult = summary.lines.find((s) => s.lineId === line.id);
            const isActive = line.id === activeLineId;
            const isRenaming = line.id === renamingLineId;
            const label = lineTabLabel(line.productName, lineIndex);

            if (isRenaming) {
              return (
                <div
                  key={line.id}
                  className="shrink-0 min-w-[160px] max-w-[220px] rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-2 py-1.5"
                >
                  <input
                    ref={renameInputRef}
                    type="text"
                    defaultValue={line.productName}
                    placeholder="Product name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        finishRename(line.id, e.currentTarget.value);
                      }
                      if (e.key === "Escape") {
                        onRenamingLineIdChange?.(null);
                      }
                    }}
                    onBlur={(e) => finishRename(line.id, e.target.value)}
                    className="w-full rounded border border-white/10 bg-slate-950 px-2 py-1 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                </div>
              );
            }

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
                <span className="font-semibold block truncate">{label}</span>
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
            title="Add line"
            aria-label="Add line"
            className="shrink-0 inline-flex items-center justify-center rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 transition min-w-[44px]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {activeLine ? (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={() => onRenamingLineIdChange?.(activeLine.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 transition"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit name
            </button>
            {request.lines.length > 1 ? (
              <button
                type="button"
                onClick={onRemoveActive}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 px-3 py-2 text-xs text-rose-300/90 hover:bg-rose-500/10 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove line
              </button>
            ) : null}
            {renamingLine ? null : (
              <p className="text-[10px] text-slate-500 truncate min-w-0 flex-1">
                Active: {lineTabLabel(activeLine.productName, request.lines.findIndex((l) => l.id === activeLine.id))}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
