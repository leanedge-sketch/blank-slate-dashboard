import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Package,
  RefreshCw,
  Ship,
  Users,
} from "lucide-react";
import {
  fetchExecutiveSummary,
  type ExecutiveReportSnapshot,
} from "../../services/api";

function money(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function locationLabel(location: string): string {
  if (location === "addis_ababa") return "Addis Ababa";
  if (location === "sez_kenya") return "SEZ Kenya";
  return location;
}

/**
 * Canonical Module 8 executive dashboard.
 * Loads ONLY from /api/v1/reports/executive-summary (materialized views).
 * No live heavy aggregations in the browser.
 */
export function ExecutiveDashboardPage() {
  const [data, setData] = useState<ExecutiveReportSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchExecutiveSummary();
      setData(snapshot);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sales = data?.sales_summary ?? [];
  const transit = data?.transit_summary ?? [];
  const stock = data?.stock_alerts ?? [];
  const crm = data?.crm_activity;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/reports"
              className="mb-3 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Reports workspace
            </Link>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400">
              Module 8 · Canonical executive dashboard
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">Executive Summary</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Financials, stock alerts, and CRM activity — served from PostgreSQL
              materialized views (no live heavy aggregations).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:border-cyan-500/40 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading materialized-view snapshot…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Financials */}
            <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-slate-950/80 p-5 lg:col-span-1">
              <div className="mb-4 flex items-center gap-2">
                <Ship className="h-4 w-4 text-violet-300" />
                <h2 className="text-sm font-semibold text-white">Financials</h2>
              </div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Sales pipeline
              </p>
              <div className="mb-5 space-y-2">
                {sales.length > 0 ? (
                  sales.map((row) => (
                    <div
                      key={`${row.stage}-${row.currency ?? "na"}`}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
                    >
                      <span className="text-slate-300">
                        {row.stage}
                        {row.currency ? ` · ${row.currency}` : ""}
                      </span>
                      <span className="font-medium text-white">
                        {row.total_deals} · ${money(row.pipeline_value_usd)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No sales roll-up rows.</p>
                )}
              </div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Procurement & transit
              </p>
              <div className="space-y-2">
                {transit.length > 0 ? (
                  transit.map((row) => (
                    <div
                      key={row.status}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
                    >
                      <span className="text-slate-300">{row.status}</span>
                      <span className="font-medium text-white">
                        {row.active_shipments} · {money(row.total_transit_value)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No in-transit roll-up rows.</p>
                )}
              </div>
            </section>

            {/* Stock alerts */}
            <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-slate-950/80 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-300" />
                <h2 className="text-sm font-semibold text-white">Top Stock Alerts</h2>
              </div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Addis Ababa & SEZ Kenya
              </p>
              <div className="space-y-2">
                {stock.length > 0 ? (
                  stock.map((row) => (
                    <div
                      key={`${row.product_id ?? row.product_name}-${row.location}`}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                        <div>
                          <p className="font-medium text-white">{row.product_name}</p>
                          <p className="text-slate-400">
                            {locationLabel(row.location)} · {money(row.available_kg)} kg
                            available · threshold {money(row.minimum_stock_threshold)} kg
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    No products below threshold in Addis Ababa or SEZ Kenya.
                  </p>
                )}
              </div>
            </section>

            {/* CRM activity */}
            <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-slate-950/80 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-300" />
                <h2 className="text-sm font-semibold text-white">CRM Activity</h2>
              </div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Last 7 days
              </p>
              {crm ? (
                <dl className="space-y-3">
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-3">
                    <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                      New customers
                    </dt>
                    <dd className="mt-1 text-2xl font-bold text-white">
                      {crm.new_customers_7d}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-3">
                    <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                      Interactions logged
                    </dt>
                    <dd className="mt-1 text-2xl font-bold text-white">
                      {crm.interactions_7d}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-3">
                    <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                      Total customers
                    </dt>
                    <dd className="mt-1 text-2xl font-bold text-white">
                      {crm.total_customers}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-slate-500">
                  CRM activity view not available yet. Run migration 009.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
