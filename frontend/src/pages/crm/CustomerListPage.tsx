import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Customer, CustomerListResponse } from "../../services/api";
import { Search, Users } from "lucide-react";

// Sales stage definitions (Brian Tracy 7-stage process)
const SALES_STAGES: Record<string, { name: string; color: string; bgColor: string }> = {
  "1": { name: "Prospecting", color: "text-slate-600", bgColor: "bg-slate-100" },
  "2": { name: "Rapport", color: "text-blue-600", bgColor: "bg-blue-100" },
  "3": { name: "Needs Analysis", color: "text-cyan-600", bgColor: "bg-cyan-100" },
  "4": { name: "Presenting Solution", color: "text-indigo-600", bgColor: "bg-indigo-100" },
  "5": { name: "Handling Objections", color: "text-purple-600", bgColor: "bg-purple-100" },
  "6": { name: "Closing", color: "text-emerald-600", bgColor: "bg-emerald-100" },
  "7": { name: "Follow-up & Cross-sell", color: "text-green-600", bgColor: "bg-green-100" },
};

function getSalesStageBadge(stage: string | null | undefined) {
  if (!stage || !SALES_STAGES[stage]) {
    return null;
  }
  const stageInfo = SALES_STAGES[stage];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageInfo.color} ${stageInfo.bgColor} border border-current/20`}
      title={`Stage ${stage}: ${stageInfo.name}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {stage} - {stageInfo.name}
    </span>
  );
}

export function CustomerListPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function fetchCustomers(query?: string) {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = { limit: 100, offset: 0 };
      if (query && query.trim().length > 0) {
        params.q = query.trim();
      }

      const res = await api.get<CustomerListResponse>("/crm/customers", {
        params,
      });
      setCustomers(res.data.customers);
      setTotal(res.data.total);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchCustomers(search);
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Header strip */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-md">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-7 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                CRM · ICP Workspace
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-50">
                  Ideal Customer Profiles
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 border border-slate-700">
                  <Users size={14} className="text-purple-400" />
                  {total} customers
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                View, edit, download, and rate AI-generated Ideal Customer Profiles. Click on a customer to manage their ICP.
              </p>
            </div>

            {/* Search */}
            <div className="w-full md:w-auto">
              <form
                onSubmit={handleSearchSubmit}
                className="w-full md:w-[360px] lg:w-[420px]"
              >
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by customer name..."
                    className="w-full rounded-full border border-slate-600 bg-slate-900/70 pl-9 pr-28 py-2.5 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/70 focus:border-purple-500/70"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-purple-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-purple-500/40 hover:bg-purple-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "Searching..." : "Search"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 sm:px-6 py-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-slate-500">
                Showing {customers.length} of {total} customers
                {search.trim() && (
                  <span className="ml-2 text-slate-400">
                    • Filtered by: <span className="font-mono">{search.trim()}</span>
                  </span>
                )}
              </p>
            </div>
            <Link
              to="/crm/customers/new"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Add Customer
            </Link>
          </div>

          {loading && (
            <div className="px-6 py-4 text-sm text-slate-500">
              Loading customers...
            </div>
          )}

          {!loading && customers.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              No customers found. Try adjusting your search or add a new customer from the CRM home page.
            </div>
          ) : (
            <div className="px-3 sm:px-4 pb-4">
              <div className="hidden md:block">
                {/* Table view on desktop */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        Display ID
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        ICP Status
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        Last Updated
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                    <tbody>
                      {customers.map((c, idx) => (
                        <tr
                          key={c.customer_id}
                          className={`transition-colors ${
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                          } hover:bg-blue-50/60`}
                        >
                          <td className="px-3 py-2 align-middle">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700 border border-slate-200 shadow-sm">
                              {c.display_id ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 align-middle text-sm font-medium text-slate-900">
                            <div className="flex flex-col">
                              <span>{c.customer_name}</span>
                              <span className="text-[11px] text-slate-400">
                                {c.created_at
                                  ? new Date(c.created_at).toLocaleDateString()
                                  : "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 align-middle">
                            {c.latest_profile_text ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Has ICP
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                No ICP
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 align-middle text-xs text-slate-500">
                            {c.latest_profile_updated_at
                              ? new Date(c.latest_profile_updated_at).toLocaleDateString()
                              : c.created_at
                              ? new Date(c.created_at).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2 align-middle text-right">
                            <Link
                              to={`/crm/customers/${c.customer_id}/profile`}
                              className="inline-flex items-center rounded-full bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-purple-500/40 hover:bg-purple-400 hover:shadow-purple-500/60 transition-colors"
                            >
                              {c.latest_profile_text ? "View ICP" : "Create ICP"}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card view on mobile */}
              <div className="grid gap-3 md:hidden pt-3">
                {customers.map((c) => (
                  <div
                    key={c.customer_id}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm shadow-slate-200/70 hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {c.customer_name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 border border-slate-200 font-mono">
                            ID: {c.display_id ?? "—"}
                          </span>
                          {c.latest_profile_text ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Has ICP
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              No ICP
                            </span>
                          )}
                          <span>
                            Updated:{" "}
                            {c.latest_profile_updated_at
                              ? new Date(c.latest_profile_updated_at).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/crm/customers/${c.customer_id}/profile`}
                        className="inline-flex items-center rounded-full bg-purple-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-purple-500/40 hover:bg-purple-400 hover:shadow-purple-500/60 transition-colors"
                      >
                        {c.latest_profile_text ? "View ICP" : "Create ICP"}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
