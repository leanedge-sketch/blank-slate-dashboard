import { useState, type ReactNode } from "react";
import { Building2, Hash, Sparkles, UserRound } from "lucide-react";
import type { TransitRequestFinancialTotals, TransitRequestItem } from "../../../../utils/transitRequestItem";
import { TransitSummaryFooter } from "./TransitSummaryFooter";
import { TransitSummaryTableRow } from "./TransitSummaryTableRow";

type TransitSummaryTableProps = {
  clientName: string;
  contactPerson?: string;
  requestRef?: string;
  items: TransitRequestItem[];
  totals: TransitRequestFinancialTotals;
  customsPaidEtb?: number;
  className?: string;
  /** Full-panel mode when opened from the Transit Summary deck (no nested dropdown). */
  fullPanel?: boolean;
  onEditLine?: (lineId: string) => void;
  onRemoveLine?: (lineId: string) => void;
  headerActions?: ReactNode;
};

const COLUMNS = [
  "Product",
  "Qty & UOM",
  "Landed/kg",
  "Total cost",
  "Selling/kg",
  "Profit/kg",
  "Margin %",
  "Revenue",
  "Actions",
] as const;

export function TransitSummaryTable({
  clientName,
  contactPerson,
  requestRef,
  items,
  totals,
  customsPaidEtb,
  className = "",
  fullPanel = false,
  onEditLine,
  onRemoveLine,
  headerActions,
}: TransitSummaryTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const label = clientName.trim() || "Unnamed client";
  const contactLabel = contactPerson?.trim() || "";
  const refLabel = requestRef?.trim() || "";

  function toggleRow(lineId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  return (
    <div
      className={`rounded-xl border border-cyan-500/25 bg-slate-900/80 backdrop-blur-md ${
        fullPanel ? "p-5 sm:p-6 min-h-[320px]" : "px-4 py-4 sm:px-5 sm:py-5"
      } ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400 shrink-0" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-500/90">
            Transit summary
          </p>
        </div>
        {headerActions ? (
          <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            <Building2 className="h-3.5 w-3.5" />
            Company
          </p>
          <p className="text-sm font-semibold text-slate-100 truncate" title={label}>
            {label}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            <UserRound className="h-3.5 w-3.5" />
            Contact person
          </p>
          <p className="text-sm font-semibold text-slate-100 truncate" title={contactLabel || "—"}>
            {contactLabel || "—"}
          </p>
        </div>
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-500/80 mb-1">
            <Hash className="h-3.5 w-3.5" />
            Request ID
          </p>
          <p
            className="text-sm font-mono font-semibold text-cyan-200 truncate"
            title={refLabel && refLabel !== "—" ? refLabel : "—"}
          >
            {refLabel && refLabel !== "—" ? refLabel : "—"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/10">
              {COLUMNS.map((col, i) => (
                <th
                  key={col}
                  className={`py-2.5 font-semibold whitespace-nowrap ${
                    col === "Actions"
                      ? "pl-2 pr-1 text-center"
                      : i === 0
                        ? "pr-2 pl-1 text-left"
                        : "pr-2 text-right"
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="py-10 text-center text-sm text-slate-500"
                >
                  No product lines in this request. Add a deal from product costing or
                  restore a line to continue.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <TransitSummaryTableRow
                  key={item.lineId}
                  item={item}
                  expanded={expandedIds.has(item.lineId)}
                  onToggle={() => toggleRow(item.lineId)}
                  onEdit={onEditLine ? () => onEditLine(item.lineId) : undefined}
                  onRemove={onRemoveLine ? () => onRemoveLine(item.lineId) : undefined}
                  canRemove={items.length > 0}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <TransitSummaryFooter totals={totals} customsPaidEtb={customsPaidEtb} />
    </div>
  );
}
