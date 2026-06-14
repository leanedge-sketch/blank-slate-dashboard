import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  DashboardMetrics,
  IntegratedReportSnapshot,
  PipelineForecast,
  PipelineInsights,
  downloadCrmReportPdf,
  fetchIntegratedReport,
  getPipelineForecast,
  getPipelineInsights,
} from "../../services/api";
import { InteractionWeeklyChart } from "../../components/InteractionWeeklyChart";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
  X,
  AlertTriangle,
  FlaskConical,
  Package,
  Warehouse,
} from "lucide-react";

const SALES_STAGES: Record<string, string> = {
  "1": "Prospecting",
  "2": "Rapport",
  "3": "Needs Analysis",
  "4": "Presenting Solution",
  "5": "Handling Objections",
  "6": "Closing",
  "7": "Follow-up & Cross-sell",
};

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatKg(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CRMReportsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [insights, setInsights] = useState<PipelineInsights | null>(null);
  const [forecast, setForecast] = useState<PipelineForecast | null>(null);
  const [integrated, setIntegrated] = useState<IntegratedReportSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysBack, setDaysBack] = useState(90);
  const [forecastDays, setForecastDays] = useState(30);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (startDate.trim()) params.start_date = startDate.trim();
      if (endDate.trim()) params.end_date = endDate.trim();

      const [metricsRes, insightsRes, forecastRes, integratedRes] = await Promise.all([
        api.get<DashboardMetrics>("/crm/dashboard/metrics", { params }),
        getPipelineInsights({ days_back: daysBack }),
        getPipelineForecast({ days_ahead: forecastDays }),
        fetchIntegratedReport({ days_back: daysBack }),
      ]);

      setMetrics(metricsRes.data);
      setInsights(insightsRes);
      setForecast(forecastRes);
      setIntegrated(integratedRes);
      setLastLoadedAt(new Date().toLocaleString());
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to load reports";
      setError(String(detail));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, daysBack, forecastDays]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const quietList = metrics?.quiet_customers ?? [];
  const quietCustomers = quietList.length;
  const weeklyInteractions = metrics?.interactions_by_week ?? [];

  async function handleExportPdf() {
    try {
      setPdfExporting(true);
      const params: Record<string, string | number> = {
        days_back: daysBack,
        forecast_days: forecastDays,
      };
      if (startDate.trim()) params.start_date = startDate.trim();
      if (endDate.trim()) params.end_date = endDate.trim();
      await downloadCrmReportPdf(params);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to export PDF";
      setError(String(detail));
    } finally {
      setPdfExporting(false);
    }
  }

  function handleExportCsv() {
    if (!metrics) return;
    const rows: string[][] = [
      ["CRM Report", `Generated ${lastLoadedAt || new Date().toLocaleString()}`],
      [],
      ["Customer coverage"],
      ["Total customers", String(metrics.total_customers)],
      ["Customers with interactions", String(metrics.customers_with_interactions)],
      ["Customers without recent activity", String(quietCustomers)],
      ...quietList.map((c) => [
        "Quiet customer",
        c.display_id ? `${c.display_id} - ${c.customer_name}` : c.customer_name,
      ]),
      [],
      ["Interaction volume"],
      ["Total interactions", String(metrics.total_interactions)],
      [
        "Avg interactions per engaged customer",
        metrics.customers_with_interactions > 0
          ? (metrics.total_interactions / metrics.customers_with_interactions).toFixed(2)
          : "0",
      ],
      [],
      ["CRM sales stages (Brian Tracy 1-7)"],
      ["Stage", "Count"],
      ...Object.entries(metrics.sales_stages_distribution).map(([k, v]) => [
        SALES_STAGES[k] || k,
        String(v),
      ]),
      ...weeklyInteractions.map((w) => [`Week ${w.week_start}`, String(w.count)]),
    ];

    if (insights) {
      rows.push(
        [],
        ["Pipeline opportunities (last " + daysBack + " days)"],
        ["Open pipeline value", String(insights.total_pipeline_value)],
        ["Forecast value (Proposal+)", String(insights.forecast_value)],
        ["Sample effectiveness %", String(insights.sample_effectiveness.toFixed(1))],
        ["Churn risk count", String(insights.churn_risk_pipelines.length)],
        [],
        ["Pipeline by stage"],
        ["Stage", "Count"],
        ...Object.entries(insights.stage_distribution).map(([stage, count]) => [
          stage,
          String(count),
        ])
      );
    }

    if (forecast) {
      rows.push(
        [],
        ["Revenue forecast (next " + forecastDays + " days)"],
        ["Total forecast", String(forecast.total_forecast_value)],
        ["Pipeline records in window", String(forecast.pipeline_count)],
        [],
        ["Forecast by stage"],
        ["Stage", "Value"],
        ...Object.entries(forecast.forecast_by_stage)
          .filter(([, v]) => v > 0)
          .map(([stage, value]) => [stage, String(value)])
      );
    }

    if (integrated) {
      rows.push(
        [],
        ["PMS catalog & pricing"],
        ["Catalog products", String(integrated.pms.catalog_product_count)],
        ["With current price", String(integrated.pms.catalog_with_current_price)],
        ["Active pricing records", String(integrated.pms.active_pricing_records)],
        ["Pricing locations", String(integrated.pms.pricing_location_count)],
        [],
        ["Stock summary"],
        ["Stock SKUs", String(integrated.stock.stock_product_count)],
        ["Total available kg", String(integrated.stock.total_available_kg)],
        ["Addis available kg", String(integrated.stock.addis_available_kg)],
        ["Low stock SKUs", String(integrated.stock.low_stock_sku_count)],
        ["Pipeline-linked movements", String(integrated.stock.pipeline_linked_movements)],
        [],
        ["Cross-module links"],
        ["Open pipeline deals", String(integrated.links.open_pipeline_deals)],
        ["Deals with catalog product", String(integrated.links.open_deals_with_catalog_product)],
        ["Deals exceeding Addis stock", String(integrated.links.deals_exceeding_addis_stock)],
      );
      if (integrated.fulfillment_risks.length > 0) {
        rows.push([], ["Fulfillment risks"], ["Product", "Customer", "Stage", "Deal qty", "Addis kg"]);
        for (const r of integrated.fulfillment_risks) {
          rows.push([
            r.product_name || "",
            r.customer_name || "",
            r.stage,
            `${r.deal_quantity ?? ""} ${r.deal_unit ?? ""}`.trim(),
            String(r.addis_available_kg),
          ]);
        }
      }
    }

    downloadCsv(`integrated-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const hasDateFilter = Boolean(startDate.trim() || endDate.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                Reports · CRM · PMS · Stock · Pipeline
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
                <FileText className="text-emerald-400" size={32} />
                Integrated Reports
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                CRM coverage, sales pipeline forecast, PMS catalog &amp; pricing, stock availability,
                and deal fulfillment risks — one connected view from Supabase.
              </p>
              {lastLoadedAt && (
                <p className="text-xs text-slate-500">Last updated: {lastLoadedAt}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadReports}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={!metrics || loading || pdfExporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {pdfExporting ? "Exporting PDF…" : "Export PDF"}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!metrics || loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CalendarDays size={18} className="text-blue-400" />
              <span>Interaction date range (optional)</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-slate-50"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-slate-50"
            />
            {hasDateFilter && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700"
              >
                <X size={14} />
                Clear
              </button>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-300 ml-auto">
              Pipeline lookback
              <select
                value={daysBack}
                onChange={(e) => setDaysBack(Number(e.target.value))}
                className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
              >
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              Forecast window
              <select
                value={forecastDays}
                onChange={(e) => setForecastDays(Number(e.target.value))}
                className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600 mb-3">
            This page covers the report sections below. Use the filters in the header, then review
            live metrics or export CSV / PDF.
          </p>
          <ul className="report-list text-sm text-slate-700 space-y-2">
            <li>
              <strong>Customer coverage</strong> – who has recent interactions and who might be
              going quiet.
            </li>
            <li>
              <strong>Interaction volume</strong> – weekly chart and touchpoints per customer.
            </li>
            <li>
              <strong>Opportunity tracking</strong> – pipeline deals, stages, and stuck pipelines.
            </li>
            <li>
              <strong>Revenue forecast</strong> – expected close value by stage.
            </li>
            <li>
              <strong>PMS &amp; stock</strong> – catalog, pricing records, inventory, and pipeline
              fulfillment gaps.
            </li>
            <li>
              <strong>Export</strong> – download structured CSV or PDF for the team.
            </li>
          </ul>
        </section>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Report failed to load</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={loadReports}
                className="mt-2 text-rose-700 underline text-sm"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {loading && !metrics ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
            <p className="text-slate-600 font-medium">Loading report data…</p>
          </div>
        ) : metrics ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="text-blue-600" size={22} />
                  <h3 className="font-semibold text-slate-800">Customer coverage</h3>
                </div>
                <p className="text-3xl font-bold">{metrics.total_customers}</p>
                <p className="text-sm text-slate-600 mt-1">Total customers</p>
                <p className="text-sm text-emerald-700 mt-2">
                  {metrics.customers_with_interactions} engaged
                  {metrics.total_customers > 0 &&
                    ` (${Math.round((metrics.customers_with_interactions / metrics.total_customers) * 100)}%)`}
                </p>
                {quietCustomers > 0 && (
                  <p className="text-sm text-amber-700 mt-1">
                    {quietCustomers} with no interactions in range
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <MessageSquare className="text-purple-600" size={22} />
                  <h3 className="font-semibold text-slate-800">Interaction volume</h3>
                </div>
                <p className="text-3xl font-bold">{metrics.total_interactions}</p>
                <p className="text-sm text-slate-600 mt-1">AI & CRM interactions</p>
                <p className="text-sm text-slate-500 mt-2">
                  {metrics.customers_with_interactions > 0
                    ? `${(metrics.total_interactions / metrics.customers_with_interactions).toFixed(1)} per engaged customer`
                    : "No engaged customers in range"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="text-indigo-600" size={22} />
                  <h3 className="font-semibold text-slate-800">Open pipeline</h3>
                </div>
                <p className="text-3xl font-bold">
                  {insights ? formatMoney(insights.total_pipeline_value) : "—"}
                </p>
                <p className="text-sm text-slate-600 mt-1">Active deal value ({daysBack}d)</p>
                {insights && (
                  <p className="text-sm text-slate-500 mt-2">
                    Committed forecast: {formatMoney(insights.forecast_value)}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="text-emerald-600" size={22} />
                  <h3 className="font-semibold text-slate-800">Revenue forecast</h3>
                </div>
                <p className="text-3xl font-bold">
                  {forecast ? formatMoney(forecast.total_forecast_value) : "—"}
                </p>
                <p className="text-sm text-slate-600 mt-1">Next {forecastDays} days</p>
                {forecast && (
                  <p className="text-sm text-slate-500 mt-2">
                    {forecast.pipeline_count} pipeline{forecast.pipeline_count === 1 ? "" : "s"} with close dates
                  </p>
                )}
              </div>
            </section>

            {integrated && (
              <>
                <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm">
                  <h3 className="text-lg font-semibold mb-1">Connected modules</h3>
                  <p className="text-sm text-slate-300 mb-4">
                    {integrated.links.open_pipeline_deals} open deals ·{" "}
                    {integrated.links.open_deals_with_catalog_product} with PMS product ·{" "}
                    {integrated.links.deals_exceeding_addis_stock} exceeding Addis stock
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                      <div className="flex items-center gap-2 text-cyan-200 mb-2">
                        <FlaskConical size={18} />
                        <span className="text-xs font-semibold uppercase">PMS</span>
                      </div>
                      <p className="text-2xl font-bold">{integrated.pms.catalog_product_count}</p>
                      <p className="text-xs text-slate-300 mt-1">Catalog products</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {integrated.pms.active_pricing_records} active prices ·{" "}
                        {integrated.pms.catalog_with_current_price} synced
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                      <div className="flex items-center gap-2 text-emerald-200 mb-2">
                        <Warehouse size={18} />
                        <span className="text-xs font-semibold uppercase">Stock</span>
                      </div>
                      <p className="text-2xl font-bold">{formatKg(integrated.stock.total_available_kg)}</p>
                      <p className="text-xs text-slate-300 mt-1">Total available</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Addis {formatKg(integrated.stock.addis_available_kg)} ·{" "}
                        {integrated.stock.low_stock_sku_count} low SKUs
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                      <div className="flex items-center gap-2 text-indigo-200 mb-2">
                        <TrendingUp size={18} />
                        <span className="text-xs font-semibold uppercase">Pipeline</span>
                      </div>
                      <p className="text-2xl font-bold">{integrated.links.open_pipeline_deals}</p>
                      <p className="text-xs text-slate-300 mt-1">Open deals</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {integrated.stock.pipeline_linked_movements} stock movements linked
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                      <div className="flex items-center gap-2 text-amber-200 mb-2">
                        <Package size={18} />
                        <span className="text-xs font-semibold uppercase">Links</span>
                      </div>
                      <p className="text-2xl font-bold">{integrated.pms.catalog_with_stock_link}</p>
                      <p className="text-xs text-slate-300 mt-1">Catalog ↔ stock SKUs</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {integrated.stock.customer_linked_movements} customer-linked movements
                      </p>
                    </div>
                  </div>
                </section>

                {integrated.fulfillment_risks.length > 0 && (
                  <section className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6">
                    <h3 className="text-lg font-semibold text-rose-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Pipeline fulfillment risks
                    </h3>
                    <p className="text-sm text-rose-800/90 mb-4">
                      Open deals where required quantity exceeds Addis Ababa available stock (via PMS
                      catalog link).
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-rose-100 bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-rose-50 text-left text-xs uppercase text-rose-800">
                          <tr>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Stage</th>
                            <th className="px-4 py-3 text-right">Deal qty</th>
                            <th className="px-4 py-3 text-right">Addis stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {integrated.fulfillment_risks.map((r) => (
                            <tr key={r.pipeline_id} className="hover:bg-rose-50/40">
                              <td className="px-4 py-3 font-medium text-slate-900">
                                {r.product_name || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  to={`/crm/customers/${r.customer_id}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {r.customer_name || r.customer_id.slice(0, 8)}
                                </Link>
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  to={`/sales/pipeline/${r.pipeline_id}`}
                                  className="text-indigo-600 hover:underline"
                                >
                                  {r.stage}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {r.deal_quantity != null
                                  ? `${r.deal_quantity} ${r.deal_unit ?? ""}`.trim()
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-rose-700 font-medium">
                                {formatKg(r.addis_available_kg)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {integrated.product_demand_top.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Top product demand (pipeline)</h3>
                    <p className="text-sm text-slate-500 mb-3">
                      Catalog products with the most deals in Proposal+ stages ({daysBack}d lookback).
                    </p>
                    <div className="space-y-2">
                      {integrated.product_demand_top.map((row) => (
                        <div
                          key={row.product_key}
                          className="flex justify-between text-sm border-b border-slate-100 pb-2"
                        >
                          <span className="text-slate-700 font-mono text-xs truncate max-w-[70%]">
                            {row.product_key === "unknown" ? "Unlinked product" : row.product_key}
                          </span>
                          <span className="font-semibold tabular-nums">{row.quote_count} deals</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {quietList.length > 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6">
                <h3 className="text-lg font-semibold text-amber-900 mb-3">Customers going quiet</h3>
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left p-2">Customer</th>
                        <th className="text-left p-2">ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quietList.slice(0, 50).map((c) => (
                        <tr key={c.customer_id}>
                          <td className="p-2">
                            <Link
                              to={`/crm/customers/${c.customer_id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {c.customer_name}
                            </Link>
                          </td>
                          <td className="p-2 text-slate-500">{c.display_id || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {quietList.length > 50 && (
                  <p className="text-xs text-amber-800 mt-2">
                    Showing 50 of {quietList.length}. Export PDF/CSV for the full list.
                  </p>
                )}
              </section>
            )}

            {weeklyInteractions.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Interactions by week</h3>
                <InteractionWeeklyChart weeks={weeklyInteractions} />
              </section>
            )}

            {insights?.insights_summary && (
              <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-6">
                <h3 className="text-lg font-semibold text-indigo-900 mb-2">AI summary</h3>
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {insights.insights_summary}
                </p>
              </section>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">CRM sales stages</h3>
                <div className="space-y-2">
                  {Object.entries(metrics.sales_stages_distribution).map(([key, count]) => (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <span className="text-slate-700">
                        {key}. {SALES_STAGES[key] || key}
                      </span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </section>

              {insights && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">Pipeline by stage ({daysBack}d)</h3>
                  <div className="space-y-2">
                    {Object.entries(insights.stage_distribution)
                      .filter(([, c]) => c > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([stage, count]) => (
                        <div key={stage} className="flex justify-between text-sm">
                          <span className="text-slate-700">{stage}</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                  </div>
                  {insights.churn_risk_pipelines.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-sm font-medium text-amber-800 mb-2">
                        Stuck pipelines (&gt;14 days in stage)
                      </p>
                      <ul className="text-xs text-slate-600 space-y-1 max-h-32 overflow-y-auto">
                        {insights.churn_risk_pipelines.slice(0, 8).map((p) => (
                          <li key={p.pipeline_id}>
                            <Link
                              to={`/sales/pipeline/${p.pipeline_id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {p.stage}
                            </Link>
                            {" · "}
                            {p.days_in_stage}d · customer {p.customer_id.slice(0, 8)}…
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}
            </div>

            {forecast && Object.values(forecast.forecast_by_stage).some((v) => v > 0) && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">
                  Forecast by stage (next {forecast.forecast_period_days} days)
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  {Object.entries(forecast.forecast_by_stage)
                    .filter(([, v]) => v > 0)
                    .map(([stage, value]) => (
                      <div
                        key={stage}
                        className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3"
                      >
                        <p className="text-xs text-slate-500">{stage}</p>
                        <p className="text-lg font-bold text-slate-900">{formatMoney(value)}</p>
                      </div>
                    ))}
                </div>
              </section>
            )}

            <p className="text-sm text-slate-500 text-center pb-8">
              Drill down in{" "}
              <Link to="/crm/dashboard" className="text-emerald-700 font-medium hover:underline">
                CRM
              </Link>
              ,{" "}
              <Link to="/sales/pipeline" className="text-emerald-700 font-medium hover:underline">
                Sales Pipeline
              </Link>
              ,{" "}
              <Link to="/pms/chemicals" className="text-emerald-700 font-medium hover:underline">
                PMS Catalog
              </Link>
              , or{" "}
              <Link to="/stock/general-availability" className="text-emerald-700 font-medium hover:underline">
                Stock
              </Link>
              .
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
