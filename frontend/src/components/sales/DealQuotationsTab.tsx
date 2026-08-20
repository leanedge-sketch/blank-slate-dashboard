import { useEffect, useState } from "react";
import { Check, FileText, Loader2 } from "lucide-react";
import {
  acceptSalesQuotation,
  fetchSalesQuotations,
  type SalesQuotation,
} from "../../services/api";
import { formatApiErrorDetail } from "../../utils/apiErrors";

type DealQuotationsTabProps = {
  pipelineId: string;
  onAccepted?: () => void;
};

export function DealQuotationsTab({ pipelineId, onAccepted }: DealQuotationsTabProps) {
  const [rows, setRows] = useState<SalesQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSalesQuotations(pipelineId);
      setRows(list);
    } catch (err) {
      setError(
        formatApiErrorDetail(
          err,
          "Could not load quotations. Run migrations/006_sales_quotations.sql.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [pipelineId]);

  async function markAccepted(quote: SalesQuotation) {
    try {
      setBusyId(quote.id);
      await acceptSalesQuotation(pipelineId, quote.id);
      await load();
      onAccepted?.();
    } catch (err) {
      alert(formatApiErrorDetail(err, "Could not accept quotation"));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading quote revisions…
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-slate-500">
        No quote revisions yet. Save a quotation on this deal to create v1.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Version</th>
            <th className="px-4 py-2">Target amount</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Created</th>
            <th className="px-4 py-2 text-right"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((quote) => (
            <tr key={quote.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-semibold text-slate-900">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-indigo-600" />
                  v{quote.version}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-800">
                {Number(quote.target_amount).toLocaleString()} {quote.currency}
              </td>
              <td className="px-4 py-3">
                {quote.is_accepted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    <Check className="h-3 w-3" /> Accepted
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Draft</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {quote.created_at
                  ? new Date(quote.created_at).toLocaleString()
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={quote.is_accepted || busyId === quote.id}
                  onClick={() => void markAccepted(quote)}
                  className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
                >
                  {busyId === quote.id ? "Saving…" : "Mark as Accepted"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
