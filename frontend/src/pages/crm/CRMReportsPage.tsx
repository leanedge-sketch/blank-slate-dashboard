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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysBack, setDaysBack] = useState(90);
  const [forecastDays, setForecastDays] = useState(30);

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
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to load report data";
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

  const avgInteractions =
    metrics && metrics.customers_with_interactions > 0
      ? (metrics.total_interactions / metrics.customers_with_interactions).toFixed(1)
      : "0";

  function handleExportCsv() {
    if (!metrics) return;
    const rows: string[][] = [
      ["CRM Report", new Date().toISOString()],
      [],
      ["Customer coverage"],
      ["Total customers", String(metrics.total_customers)],
      ["With interactions", String(metrics.customers_with_interactions)],
      ["Without interactions in range", String(quietCustomers)],
      [],
      ["Interaction volume"],
      ["Total interactions", String(metrics.total_interactions)],
      ["Avg per engaged customer", avgInteractions],
    ];
    if (insights) {
      rows.push(
        [],
        ["Opportunity tracking"],
        ["Open pipeline value", String(insights.total_pipeline_value)],
        ["Committed forecast value", String(insights.forecast_value)],
        ...Object.entries(insights.stage_distribution)
          .filter(([, n]) => n > 0)
          .map(([stage, n]) => [stage, String(n)])
      );
    }
    if (forecast) {
      rows.push(
        [],
        ["Forecast", `Next ${forecastDays} days`],
        ["Total", String(forecast.total_forecast_value)],
        ...Object.entries(forecast.forecast_by_stage)
          .filter(([, v]) => v > 0)
          .map(([s, v]) => [s, String(v)])
      );
    }
    downloadCsv(`crm-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>CRM Reports</h2>
          <p className="page-subtitle">
            Pipeline, activity, and interaction reports from your Supabase data.
          </p>
        </div>
        <div className="search-form" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Interaction start date"
          />
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="Interaction end date"
          />
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            title="Pipeline lookback"
            style={{ padding: "0.45rem 0.6rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
          >
            <option value={30}>Pipeline 30d</option>
            <option value={90}>Pipeline 90d</option>
            <option value={180}>Pipeline 180d</option>
          </select>
          <button type="button" className="btn-secondary" onClick={loadReports} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExportCsv}
            disabled={!metrics || loading}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <section className="card" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
          <p style={{ margin: 0, color: "#b91c1c" }}>
            <strong>Could not load reports:</strong> {error}
          </p>
          <button type="button" className="btn-secondary" style={{ marginTop: "0.75rem" }} onClick={loadReports}>
            Try again
          </button>
        </section>
      )}

      <section className="card">
        <p className="section-description">Report sections (connected to live data below):</p>
        <ul className="report-list">
          <li>
            <strong>Customer coverage</strong> – who has recent interactions and who might be
            going quiet.
          </li>
          <li>
            <strong>Interaction volume</strong> – AI and human touchpoints per customer.
          </li>
          <li>
            <strong>Opportunity tracking</strong> – sales pipeline deals and stage.
          </li>
          <li>
            <strong>Export</strong> – download CSV for the team.
          </li>
        </ul>
      </section>

      {loading && !metrics ? (
        <section className="card">
          <p className="section-description">Loading report data…</p>
        </section>
      ) : metrics ? (
        <>
          <section className="card">
            <h3 style={{ marginTop: 0 }}>Customer coverage</h3>
            <div className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
              <div>
                <p className="metric-label" style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>Total customers</p>
                <p className="metric-value" style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0.25rem 0 0" }}>
                  {metrics.total_customers}
                </p>
              </div>
              <div>
                <p className="metric-label" style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>With interactions</p>
                <p className="metric-value" style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0.25rem 0 0" }}>
                  {metrics.customers_with_interactions}
                </p>
              </div>
              <div>
                <p className="metric-label" style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>Quiet in range</p>
                <p className="metric-value" style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0.25rem 0 0" }}>
                  {quietCustomers}
                </p>
              </div>
            </div>
            <p className="section-description" style={{ marginBottom: 0 }}>
              {metrics.total_customers > 0
                ? `${Math.round((metrics.customers_with_interactions / metrics.total_customers) * 100)}% of customers have at least one interaction in the selected date range.`
                : "No customers in the database yet."}
            </p>
          </section>

          <section className="card">
            <h3 style={{ marginTop: 0 }}>Interaction volume</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>Total interactions</p>
                <p style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0.25rem 0 0" }}>{metrics.total_interactions}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>Avg per engaged customer</p>
                <p style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0.25rem 0 0" }}>{avgInteractions}</p>
              </div>
            </div>
            <h4 style={{ fontSize: "0.95rem", marginTop: "1.25rem" }}>CRM sales stages (customers)</h4>
            <table className="data-table" style={{ width: "100%", fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Stage</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics.sales_stages_distribution).map(([key, count]) => (
                  <tr key={key}>
                    <td style={{ padding: "0.5rem" }}>
                      {key}. {SALES_STAGES[key] || key}
                    </td>
                    <td style={{ textAlign: "right", padding: "0.5rem", fontWeight: 600 }}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {insights && (
            <section className="card">
              <h3 style={{ marginTop: 0 }}>Opportunity tracking</h3>
              <p className="section-description">
                Sales pipeline activity in the last {daysBack} days.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>Open pipeline value</p>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0" }}>
                    {formatMoney(insights.total_pipeline_value)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>Proposal+ value</p>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0" }}>
                    {formatMoney(insights.forecast_value)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>Stuck (&gt;14 days)</p>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.25rem 0 0" }}>
                    {insights.churn_risk_pipelines.length}
                  </p>
                </div>
              </div>
              <h4 style={{ fontSize: "0.95rem" }}>Deals by pipeline stage</h4>
              <table className="data-table" style={{ width: "100%", fontSize: "0.9rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.5rem" }}>Stage</th>
                    <th style={{ textAlign: "right", padding: "0.5rem" }}>Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(insights.stage_distribution)
                    .filter(([, n]) => n > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([stage, count]) => (
                      <tr key={stage}>
                        <td style={{ padding: "0.5rem" }}>{stage}</td>
                        <td style={{ textAlign: "right", padding: "0.5rem", fontWeight: 600 }}>{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {insights.churn_risk_pipelines.length > 0 && (
                <>
                  <h4 style={{ fontSize: "0.95rem", marginTop: "1rem" }}>Needs attention</h4>
                  <ul className="report-list">
                    {insights.churn_risk_pipelines.slice(0, 5).map((p) => (
                      <li key={p.pipeline_id}>
                        <Link to={`/sales/pipeline/${p.pipeline_id}`}>{p.stage}</Link>
                        {" — "}
                        {p.days_in_stage} days in stage
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {insights.insights_summary && (
                <p className="section-description" style={{ marginTop: "1rem", fontStyle: "italic" }}>
                  {insights.insights_summary}
                </p>
              )}
            </section>
          )}

          {forecast && (
            <section className="card">
              <h3 style={{ marginTop: 0 }}>Revenue forecast</h3>
              <p className="section-description">
                Expected close dates in the next {forecastDays} days ({forecast.pipeline_count} pipeline
                {forecast.pipeline_count === 1 ? "" : "s"}).
              </p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.5rem 0 1rem" }}>
                {formatMoney(forecast.total_forecast_value)}
              </p>
              <table className="data-table" style={{ width: "100%", fontSize: "0.9rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.5rem" }}>Stage</th>
                    <th style={{ textAlign: "right", padding: "0.5rem" }}>Forecast</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(forecast.forecast_by_stage)
                    .filter(([, v]) => v > 0)
                    .map(([stage, value]) => (
                      <tr key={stage}>
                        <td style={{ padding: "0.5rem" }}>{stage}</td>
                        <td style={{ textAlign: "right", padding: "0.5rem" }}>{formatMoney(value)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          )}

          <p className="section-description">
            More detail: <Link to="/crm/dashboard">CRM Dashboard</Link> ·{" "}
            <Link to="/sales/pipeline">Sales Pipeline</Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
