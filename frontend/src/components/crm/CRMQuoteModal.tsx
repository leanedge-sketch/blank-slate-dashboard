import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  Customer,
  CustomerListResponse,
  ensureQuotePipeline,
  fetchSalesPipelines,
  SalesPipeline,
} from "../../services/api";
import { getPipelineProductLabel } from "../../utils/pipelineProduct";
import { useProductCatalog } from "../../contexts/ProductCatalogContext";
import { Loader2, Plus, X } from "lucide-react";

const CLOSED_STAGES = new Set(["Closed", "Lost"]);

type CRMQuoteModalProps = {
  open: boolean;
  onClose?: () => void;
  /** When set, customer is locked (profile / detail page). */
  customerId?: string | null;
  customerName?: string | null;
  /** Called after a deal is bound; if omitted, navigates to the quote form. */
  onBound?: (result: {
    pipeline_id: string;
    customer: Customer | null;
    stage?: string | null;
    created: boolean;
  }) => void;
};

export function CRMQuoteModal({
  open,
  onClose,
  customerId,
  customerName,
  onBound,
}: CRMQuoteModalProps) {
  const navigate = useNavigate();
  const { chemicals, chemicalTypes } = useProductCatalog();
  const [search, setSearch] = useState(customerName ?? "");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [pipelines, setPipelines] = useState<SalesPipeline[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [dealId, setDealId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lockedCustomer = Boolean(customerId);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDealId("");
    if (customerId) {
      api
        .get<Customer>(`/crm/customers/${customerId}`)
        .then((res) => {
          setSelected(res.data);
          setSearch(res.data.customer_name);
        })
        .catch(() => {
          setSelected(
            customerName
              ? ({
                  customer_id: customerId,
                  customer_name: customerName,
                } as Customer)
              : null,
          );
        });
    } else {
      setSelected(null);
      setSearch("");
    }
  }, [open, customerId, customerName]);

  useEffect(() => {
    if (!open || lockedCustomer) return;
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await api.get<CustomerListResponse>("/crm/customers", {
          params: { q: term, limit: 8, offset: 0 },
        });
        if (!cancelled) setResults(res.data.customers);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, open, lockedCustomer]);

  useEffect(() => {
    const cid = selected?.customer_id || customerId;
    if (!open || !cid) {
      setPipelines([]);
      return;
    }
    let cancelled = false;
    setLoadingDeals(true);
    fetchSalesPipelines({
      customer_id: cid,
      limit: 100,
      latest_per_deal: true,
    })
      .then((res) => {
        if (cancelled) return;
        setPipelines(
          (res.pipelines ?? []).filter((p) => !CLOSED_STAGES.has(p.stage)),
        );
      })
      .catch(() => {
        if (!cancelled) setPipelines([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDeals(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selected?.customer_id, customerId]);

  const productLabelOptions = useMemo(
    () => ({ chemicalFullData: chemicals, chemicalTypes, tdsList: [] }),
    [chemicals, chemicalTypes],
  );

  if (!open) return null;

  async function finish(pipeline_id: string, created: boolean, stage?: string | null) {
    const customer = selected;
    if (onBound) {
      onBound({ pipeline_id, customer, stage, created });
      onClose?.();
      return;
    }
    const params = new URLSearchParams();
    params.set("pipeline_id", pipeline_id);
    if (customer?.customer_id) params.set("customer_id", customer.customer_id);
    navigate(`/crm/quotes/new?${params.toString()}`);
    onClose?.();
  }

  async function useExistingDeal() {
    if (!dealId) {
      setError("Select an open deal, or create a new deal.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const bound = await ensureQuotePipeline({
        pipeline_id: dealId,
        customer_id: selected?.customer_id ?? customerId ?? null,
        customer_name: selected?.customer_name ?? customerName ?? null,
      });
      await finish(bound.pipeline_id, false, bound.stage);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : err instanceof Error
            ? err.message
            : "Could not bind quote to deal";
      setError(typeof message === "string" ? message : "Could not bind quote to deal");
    } finally {
      setSaving(false);
    }
  }

  async function createNewDeal() {
    const cid = selected?.customer_id || customerId;
    const name = selected?.customer_name || customerName || search.trim();
    if (!cid && !name) {
      setError("Select a CRM customer before creating a quote.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const bound = await ensureQuotePipeline({
        customer_id: cid ?? null,
        customer_name: name || null,
        force_new: true,
      });
      await finish(bound.pipeline_id, true, bound.stage);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not create a new deal";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Bind quote to a deal</h2>
            <p className="mt-1 text-xs text-slate-500">
              CRM quotes cannot be standalone. Choose an open sales pipeline deal for this
              customer, or create a new deal.
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Customer</label>
            <input
              value={search}
              disabled={lockedCustomer}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
              }}
              placeholder="Search CRM customers"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            {searching ? (
              <p className="mt-1 text-[11px] text-slate-500">Searching…</p>
            ) : null}
            {!lockedCustomer && results.length > 0 && !selected ? (
              <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-slate-200 text-xs">
                {results.map((c) => (
                  <button
                    key={c.customer_id}
                    type="button"
                    className="block w-full px-3 py-1.5 text-left hover:bg-blue-50"
                    onClick={() => {
                      setSelected(c);
                      setSearch(c.customer_name);
                      setResults([]);
                    }}
                  >
                    {c.customer_name}
                    {c.display_id ? (
                      <span className="text-slate-500"> ({c.display_id})</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            {selected ? (
              <p className="mt-1 text-[11px] text-emerald-700">
                {selected.customer_name}
                {selected.display_id ? ` (${selected.display_id})` : ""}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Open sales deals
            </label>
            {loadingDeals ? (
              <p className="text-xs text-slate-500">Loading deals…</p>
            ) : (
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select an open deal…</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getPipelineProductLabel(p, productLabelOptions)} — {p.stage}
                  </option>
                ))}
              </select>
            )}
            {!loadingDeals && selected && pipelines.length === 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">
                No open deals for this customer. Create a new deal to continue.
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={createNewDeal}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Plus size={14} />
            Create New Deal
          </button>
          <button
            type="button"
            disabled={saving || !dealId}
            onClick={useExistingDeal}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Use selected deal
          </button>
        </div>
      </div>
    </div>
  );
}
