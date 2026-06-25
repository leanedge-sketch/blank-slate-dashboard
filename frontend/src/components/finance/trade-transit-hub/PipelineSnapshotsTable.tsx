import { Fragment, useMemo } from "react";
import type { ImportFinanceProduct, ImportShipmentRow } from "../../../services/importFinance";
import { formatEtb, formatNumber } from "../../../utils/importFinanceCalc";
import { groupPipelineSnapshots } from "../../../utils/pipelineSnapshotGroups";

function marginTone(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "text-slate-500";
  if (pct < 0) return "text-rose-400 font-semibold";
  if (pct >= 15) return "text-emerald-400 font-semibold";
  return "text-amber-400 font-semibold";
}

type PipelineSnapshotsTableProps = {
  shipments: ImportShipmentRow[];
  products: ImportFinanceProduct[];
  loadedShipmentId: string | null;
  onLoadGroup: (rows: ImportShipmentRow[]) => void;
  onLoadRow: (row: ImportShipmentRow) => void;
};

export function PipelineSnapshotsTable({
  shipments,
  products,
  loadedShipmentId,
  onLoadGroup,
  onLoadRow,
}: PipelineSnapshotsTableProps) {
  const groups = useMemo(
    () => groupPipelineSnapshots(shipments, products),
    [shipments, products],
  );

  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-6 text-center">
        No saved snapshots yet. Complete a calculation and use Save all product lines.
      </p>
    );
  }

  return (
    <table className="w-full min-w-[960px] text-sm text-left">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/10">
          <th className="py-2 pr-3 font-medium">Request ID</th>
          <th className="py-2 pr-3 font-medium">Customer</th>
          <th className="py-2 pr-3 font-medium">Product</th>
          <th className="py-2 pr-3 font-medium text-right">Qty</th>
          <th className="py-2 pr-3 font-medium text-right">Capital</th>
          <th className="py-2 pr-3 font-medium text-right">Customs</th>
          <th className="py-2 pr-3 font-medium text-right">Landed/kg</th>
          <th className="py-2 pr-3 font-medium text-right">Target/kg</th>
          <th className="py-2 pr-3 font-medium text-right">Margin</th>
          <th className="py-2 pr-3 font-medium text-right">Revenue</th>
          <th className="py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <Fragment key={group.key}>
            {group.rows.map((row, index) => {
              const isLoaded = loadedShipmentId === row.id;
              return (
                <tr
                  key={row.id}
                  onClick={() => onLoadRow(row)}
                  className={`border-b border-white/5 cursor-pointer transition ${
                    isLoaded ? "bg-cyan-500/10" : "hover:bg-white/5"
                  }`}
                >
                  <td className="py-2.5 pr-3 text-slate-300 font-mono text-xs align-top">
                    {index === 0 ? (
                      <button
                        type="button"
                        className="text-left hover:text-cyan-300 underline-offset-2 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadGroup(group.rows);
                        }}
                        title="Load all products in this request"
                      >
                        {group.requestRef}
                      </button>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-200 align-top">
                    {index === 0 ? group.clientName : null}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-200">{row.productLabel}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                    {Number(row.quantity_kg).toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                    {row.capital_outlay_etb != null
                      ? formatEtb(Number(row.capital_outlay_etb), 0)
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                    {row.total_customs_paid_etb != null
                      ? formatEtb(Number(row.total_customs_paid_etb), 0)
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-emerald-400">
                    {row.final_landed_unit_cost_etb_per_kg != null
                      ? formatNumber(Number(row.final_landed_unit_cost_etb_per_kg), 2)
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                    {row.target_selling_price_etb_per_kg != null
                      ? formatNumber(Number(row.target_selling_price_etb_per_kg), 2)
                      : "—"}
                  </td>
                  <td
                    className={`py-2.5 pr-3 text-right tabular-nums ${marginTone(
                      row.gross_margin_pct != null
                        ? Number(row.gross_margin_pct)
                        : null,
                    )}`}
                  >
                    {row.gross_margin_pct != null
                      ? `${formatNumber(Number(row.gross_margin_pct), 1)}%`
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                    {row.total_expected_revenue_etb != null
                      ? formatEtb(Number(row.total_expected_revenue_etb), 0)
                      : "—"}
                  </td>
                  <td className="py-2.5 text-slate-500 text-xs">{row.status}</td>
                </tr>
              );
            })}
            <tr className="border-b border-white/10 bg-white/[0.03] font-semibold">
              <td
                colSpan={3}
                className="py-2.5 pr-3 text-slate-400 text-xs uppercase tracking-wide"
              >
                Total ({group.rows.length} product{group.rows.length === 1 ? "" : "s"})
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">
                {group.totals.quantityKg.toLocaleString()}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">
                {formatEtb(group.totals.capitalOutlayEtb, 0)}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">
                {formatEtb(group.totals.customsEtb, 0)}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-300">
                {group.totals.weightedLandedPerKg > 0
                  ? formatNumber(group.totals.weightedLandedPerKg, 2)
                  : "—"}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">
                {group.totals.weightedTargetPerKg > 0
                  ? formatNumber(group.totals.weightedTargetPerKg, 2)
                  : "—"}
              </td>
              <td
                className={`py-2.5 pr-3 text-right tabular-nums ${marginTone(
                  group.totals.avgMarginPct,
                )}`}
              >
                {group.totals.avgMarginPct != null
                  ? `${formatNumber(group.totals.avgMarginPct, 1)}%`
                  : "—"}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">
                {formatEtb(group.totals.revenueEtb, 0)}
              </td>
              <td className="py-2.5" />
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
