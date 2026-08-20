import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, Customer, CustomerListResponse } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { GitMerge } from "lucide-react";

const MERGE_FIELDS: { key: keyof Customer; label: string }[] = [
  { key: "customer_name", label: "Company name" },
  { key: "display_id", label: "Display ID" },
  { key: "website_url", label: "Website" },
  { key: "linkedin_company_url", label: "LinkedIn" },
  { key: "primary_contact_name", label: "Primary contact" },
  { key: "primary_contact_email", label: "Contact email" },
  { key: "primary_contact_phone", label: "Contact phone" },
  { key: "sales_stage", label: "Sales stage" },
];

type Winner = "source" | "target";

export function CustomerMergePage() {
  const { employeeRole, employeeLoading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [winners, setWinners] = useState<Record<string, Winner>>({});
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CustomerListResponse>("/crm/customers", {
        params: { limit: 1000, offset: 0 },
      })
      .then((res) => setCustomers(res.data.customers))
      .catch((err) =>
        setError(err?.response?.data?.detail ?? "Failed to load customers"),
      )
      .finally(() => setLoading(false));
  }, []);

  const source = customers.find((c) => c.customer_id === sourceId) ?? null;
  const target = customers.find((c) => c.customer_id === targetId) ?? null;

  const conflicting = useMemo(() => {
    if (!source || !target) return [];
    return MERGE_FIELDS.filter((field) => {
      const a = String(source[field.key] ?? "").trim();
      const b = String(target[field.key] ?? "").trim();
      return a !== b && (a.length > 0 || b.length > 0);
    });
  }, [source, target]);

  if (employeeLoading) {
    return (
      <div className="page">
        <p className="text-sm text-slate-500">Checking admin access…</p>
      </div>
    );
  }

  if (employeeRole !== "admin") {
    return <Navigate to="/crm" replace />;
  }

  async function handleMerge() {
    if (!source || !target) {
      setError("Select both a source customer (to delete) and a target (to keep).");
      return;
    }
    if (
      !window.confirm(
        `Merge "${source.customer_name}" into "${target.customer_name}"?\n\nThe source record will be deleted after related interactions, sales deals, and procurement pipelines are moved.`,
      )
    ) {
      return;
    }
    try {
      setMerging(true);
      setError(null);
      setDone(null);
      const fields: Record<string, Winner> = {};
      for (const field of conflicting) {
        fields[field.key] = winners[field.key] ?? "target";
      }
      const res = await api.post<{ target: Customer }>("/crm/customers/merge", {
        source_customer_id: source.customer_id,
        target_customer_id: target.customer_id,
        fields,
      });
      setDone(
        `Merged into ${res.data.target.customer_name}. Source customer was deleted.`,
      );
      setCustomers((prev) =>
        prev
          .filter((c) => c.customer_id !== source.customer_id)
          .map((c) =>
            c.customer_id === target.customer_id ? res.data.target : c,
          ),
      );
      setSourceId("");
      setTargetId(res.data.target.customer_id);
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : null;
      setError(detail || (err instanceof Error ? err.message : "Merge failed"));
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Merge customers</h2>
          <p className="page-subtitle">
            Admin only. Move interactions, sales pipeline deals, and procurement
            records onto the surviving customer, then delete the duplicate.
          </p>
        </div>
        <Link to="/crm/customers/manage" className="text-sm font-medium text-blue-600">
          ← Manage customers
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading customers…</p>
      ) : (
        <div className="space-y-6 max-w-5xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Source (will be deleted)</span>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Select source…</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id} disabled={c.customer_id === targetId}>
                    {c.customer_name}
                    {c.display_id ? ` (${c.display_id})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Target (survives)</span>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Select target…</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id} disabled={c.customer_id === sourceId}>
                    {c.customer_name}
                    {c.display_id ? ` (${c.display_id})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {source && target ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Field</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Target</th>
                    <th className="px-4 py-2">Keep</th>
                  </tr>
                </thead>
                <tbody>
                  {MERGE_FIELDS.map((field) => {
                    const sv = String(source[field.key] ?? "") || "—";
                    const tv = String(target[field.key] ?? "") || "—";
                    const differs = conflicting.some((f) => f.key === field.key);
                    return (
                      <tr key={field.key} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium text-slate-700">{field.label}</td>
                        <td className="px-4 py-2 text-slate-600 break-all">{sv}</td>
                        <td className="px-4 py-2 text-slate-600 break-all">{tv}</td>
                        <td className="px-4 py-2">
                          {differs ? (
                            <select
                              value={winners[field.key] ?? "target"}
                              onChange={(e) =>
                                setWinners((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value as Winner,
                                }))
                              }
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              <option value="target">Target</option>
                              <option value="source">Source</option>
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400">Same</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {done ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {done}
            </div>
          ) : null}

          <button
            type="button"
            disabled={merging || !source || !target}
            onClick={handleMerge}
            className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
          >
            <GitMerge size={16} />
            {merging ? "Merging…" : "Merge and delete source"}
          </button>
        </div>
      )}
    </div>
  );
}
