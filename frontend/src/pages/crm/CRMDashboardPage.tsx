import { useEffect, useState } from "react";
import { api, DashboardMetrics } from "../../services/api";
import { BarChart3, Users, MessageSquare, TrendingUp, CalendarDays, X, Loader2, Sparkles } from "lucide-react";

// Helper functions for date formatting (not needed anymore, but kept for potential future use)

// Sales stage definitions with colors
const SALES_STAGES: { [key: string]: { name: string; color: string; bgColor: string; borderColor: string } } = {
  "1": { name: "Prospecting", color: "text-slate-700", bgColor: "bg-slate-100", borderColor: "border-slate-300" },
  "2": { name: "Rapport", color: "text-blue-700", bgColor: "bg-blue-100", borderColor: "border-blue-300" },
  "3": { name: "Needs Analysis", color: "text-cyan-700", bgColor: "bg-cyan-100", borderColor: "border-cyan-300" },
  "4": { name: "Presenting Solution", color: "text-indigo-700", bgColor: "bg-indigo-100", borderColor: "border-indigo-300" },
  "5": { name: "Handling Objections", color: "text-purple-700", bgColor: "bg-purple-100", borderColor: "border-purple-300" },
  "6": { name: "Closing", color: "text-emerald-700", bgColor: "bg-emerald-100", borderColor: "border-emerald-300" },
  "7": { name: "Follow-up & Cross-sell", color: "text-green-700", bgColor: "bg-green-100", borderColor: "border-green-300" },
};

export function CRMDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date filtering states - optional, defaults to empty (all-time)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  async function loadMetrics() {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      // Only add date params if they are explicitly set
      if (startDate && startDate.trim()) params.start_date = startDate.trim();
      if (endDate && endDate.trim()) params.end_date = endDate.trim();

      const res = await api.get<DashboardMetrics>("/crm/dashboard/metrics", { params });
      setMetrics(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  function clearDateFilter() {
    setStartDate("");
    setEndDate("");
  }

  const hasDateFilter = startDate.trim() || endDate.trim();

  const totalStages = metrics
    ? Object.values(metrics.sales_stages_distribution).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                CRM · Analytics Dashboard
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
                <BarChart3 className="text-blue-400" size={32} />
                CRM Dashboard
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Real-time insights into your customer relationships, interactions, and sales pipeline.
              </p>
            </div>

            {/* Date Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <CalendarDays size={18} className="text-blue-400" />
                <span className="font-medium">
                  {hasDateFilter ? "Filtered by date:" : "Filter by date (optional):"}
                </span>
                {!hasDateFilter && (
                  <span className="text-xs text-slate-400 italic">Showing all-time data</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                />
                {hasDateFilter && (
                  <button
                    onClick={clearDateFilter}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/80 transition-colors"
                    title="Clear filter and show all-time data"
                  >
                    <X size={14} />
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        {loading && !metrics ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
              <p className="text-slate-600 font-medium">Loading dashboard metrics...</p>
            </div>
          </div>
        ) : metrics ? (
          <>
            {/* Key Metrics Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Total Customers */}
              <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-blue-100">
                      <Users className="text-blue-600" size={24} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-slate-900">{metrics.total_customers}</p>
                    <p className="text-sm text-slate-600">Customers in database</p>
                  </div>
                </div>
              </div>

              {/* Total Interactions */}
              <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-purple-100">
                      <MessageSquare className="text-purple-600" size={24} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-slate-900">{metrics.total_interactions}</p>
                    <p className="text-sm text-slate-600">AI interactions</p>
                  </div>
                </div>
              </div>

              {/* Customers with Interactions */}
              <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-emerald-100">
                      <TrendingUp className="text-emerald-600" size={24} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-slate-900">{metrics.customers_with_interactions}</p>
                    <p className="text-sm text-slate-600">Customers engaged</p>
                    {metrics.total_customers > 0 && (
                      <p className="text-xs text-slate-500">
                        {Math.round((metrics.customers_with_interactions / metrics.total_customers) * 100)}% of total
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Average Interactions per Customer */}
              <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-amber-100">
                      <Sparkles className="text-amber-600" size={24} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Average</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-slate-900">
                      {metrics.customers_with_interactions > 0
                        ? (metrics.total_interactions / metrics.customers_with_interactions).toFixed(1)
                        : "0.0"}
                    </p>
                    <p className="text-sm text-slate-600">Interactions per customer</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Stages Dashboard */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="text-blue-600" size={24} />
                      Sales Pipeline Stages
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Distribution of customers across the 7-stage sales process
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{totalStages}</p>
                    <p className="text-xs text-slate-500">Customers with stages</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
                  {Object.entries(SALES_STAGES).map(([stageNum, stageInfo]) => {
                    const count = metrics.sales_stages_distribution[stageNum] || 0;
                    const percentage = totalStages > 0 ? (count / totalStages) * 100 : 0;

                    return (
                      <div
                        key={stageNum}
                        className={`relative overflow-hidden rounded-xl border-2 ${stageInfo.borderColor} ${stageInfo.bgColor} p-5 transition-all duration-300 hover:scale-105 hover:shadow-lg`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className={`text-lg font-bold ${stageInfo.color}`}>{stageNum}</span>
                            <span className={`text-2xl font-extrabold ${stageInfo.color}`}>{count}</span>
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${stageInfo.color} mb-2`}>{stageInfo.name}</p>
                            <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full ${stageInfo.bgColor} transition-all duration-500`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary Stats */}
                <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <p className="text-xs font-medium text-slate-600 mb-1">Early Stage</p>
                    <p className="text-lg font-bold text-slate-900">
                      {(metrics.sales_stages_distribution["1"] || 0) +
                        (metrics.sales_stages_distribution["2"] || 0) +
                        (metrics.sales_stages_distribution["3"] || 0)}
                    </p>
                    <p className="text-xs text-slate-500">Stages 1-3</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <p className="text-xs font-medium text-slate-600 mb-1">Mid Stage</p>
                    <p className="text-lg font-bold text-slate-900">
                      {(metrics.sales_stages_distribution["4"] || 0) + (metrics.sales_stages_distribution["5"] || 0)}
                    </p>
                    <p className="text-xs text-slate-500">Stages 4-5</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <p className="text-xs font-medium text-slate-600 mb-1">Closing</p>
                    <p className="text-lg font-bold text-slate-900">{metrics.sales_stages_distribution["6"] || 0}</p>
                    <p className="text-xs text-slate-500">Stage 6</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <p className="text-xs font-medium text-slate-600 mb-1">Post-Sale</p>
                    <p className="text-lg font-bold text-slate-900">{metrics.sales_stages_distribution["7"] || 0}</p>
                    <p className="text-xs text-slate-500">Stage 7</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
