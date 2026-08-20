import { useEffect, useState } from "react";
import { Loader2, Ship } from "lucide-react";
import {
  fetchTradeTransitForDeal,
  type ImportShipmentRow,
} from "../../services/importFinance";

type TradeTransitSyncPanelProps = {
  salesPipelineId: string;
  chemicalTypeId?: string | null;
  customerId?: string | null;
};

function money(value: number | null | undefined, suffix = "ETB") {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${suffix}`;
}

export function TradeTransitSyncPanel({
  salesPipelineId,
  chemicalTypeId,
  customerId,
}: TradeTransitSyncPanelProps) {
  const [row, setRow] = useState<ImportShipmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchTradeTransitForDeal({
      salesPipelineId,
      chemicalTypeId,
      customerId,
    })
      .then((data) => {
        if (!cancelled) setRow(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load Trade & Transit.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salesPipelineId, chemicalTypeId, customerId]);

  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Ship className="h-4 w-4 text-teal-700" />
        <h3 className="text-sm font-semibold text-slate-900">Trade & Transit margin</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Read only
        </span>
      </div>
      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading procurement snapshot…
        </p>
      ) : error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : !row ? (
        <p className="text-sm text-slate-500">
          No procurement pipeline is linked to this deal yet.
        </p>
      ) : (
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Landed cost
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {money(row.net_landed_cost_etb)}
            </dd>
            {row.final_landed_unit_cost_etb_per_kg != null ? (
              <p className="text-xs text-slate-500">
                {money(row.final_landed_unit_cost_etb_per_kg)} / kg
              </p>
            ) : null}
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Estimated margin
            </dt>
            <dd className="mt-1 text-lg font-semibold text-emerald-700">
              {row.gross_margin_pct != null
                ? `${Number(row.gross_margin_pct).toFixed(1)}%`
                : "—"}
            </dd>
            {row.profit_per_kg_etb != null ? (
              <p className="text-xs text-slate-500">
                {money(row.profit_per_kg_etb)} / kg
              </p>
            ) : null}
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Supplier base
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {money(row.supplier_base_price_usd, "USD")}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
