import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  DashboardMetrics,
  PipelineForecast,
  PipelineInsights,
  getPipelineForecast,
  getPipelineInsights,
} from "../../services/api";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysBack, setDaysBack] = useState(90);
  const [forecastDays, setForecastDays] = useState(30);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (startDate.trim()) params.start_date = startDate.trim();
      if (endDate.trim()) params.end_date = endDate.trim();

      const [metricsRes, insightsRes, forecastRes] = await Promise.all([
        api.get<DashboardMetrics>("/crm/dashboard/metrics", { params }),
        getPipelineInsights({ days_back: daysBack }),
        getPipelineForecast({ days_ahead: forecastDays }),
      ]);

      setMetrics(metricsRes.data);
      setInsights(insightsRes);
      setForecast(forecastRes);
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

  const quietCustomers =
    metrics && metrics.total_customers > metrics.customers_with_interactions
      ? metrics.total_customers - metrics.customers_with_interactions
      : 0;

  function handleExportCsv() {
    if (!metrics) return;
    const rows: string[][] = [
      ["CRM Report", `Generated ${lastLoadedAt || new Date().toLocaleString()}`],
      [],
      ["Customer coverage"],
      ["Total customers", String(metrics.total_customers)],
      ["Customers with interactions", String(metrics.customers_with_interactions)],
      ["Customers without recent activity", String(quietCustomers)],
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

    downloadCsv(`crm-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const hasDateFilter = Boolean(startDate.trim() || endDate.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                CRM · Reports
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
                <FileText className="text-emerald-400" size={32} />
                CRM Reports
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Live coverage, interaction volume, sales pipeline opportunities, and forecast — loaded
                from your Supabase data.
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
              Need more detail? Open the{" "}
              <Link to="/crm/dashboard" className="text-emerald-700 font-medium hover:underline">
                CRM Dashboard
              </Link>{" "}
              or{" "}
              <Link to="/sales/pipeline" className="text-emerald-700 font-medium hover:underline">
                Sales Pipeline
              </Link>
              .
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
