import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, Package, Warehouse } from "lucide-react";
import {
  fetchPipelineStockContext,
  StockPipelineContext,
  StockMovement,
} from "../../services/api";

function formatKg(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
}

function locationLabel(loc: string): string {
  if (loc === "addis_ababa") return "Addis Ababa";
  if (loc === "sez_kenya") return "SEZ Kenya";
  if (loc === "nairobi_partner") return "Nairobi Partner";
  return loc;
}

function movementSummary(m: StockMovement): string {
  const parts: string[] = [];
  if (m.sold_kg > 0) parts.push(`Sold ${m.sold_kg} kg`);
  if (m.purchase_kg > 0) parts.push(`Purchase ${m.purchase_kg} kg`);
  if (m.inter_company_transfer_kg > 0) parts.push(`Transfer ${m.inter_company_transfer_kg} kg`);
  if (m.sample_or_damage_kg > 0) parts.push(`Sample/Damage ${m.sample_or_damage_kg} kg`);
  return parts.join(" · ") || m.transaction_type;
}

export function StockIntegrationPanel({
  pipelineId,
  catalogUuidId,
  customerId,
}: {
  pipelineId: string;
  catalogUuidId?: string | null;
  customerId?: string | null;
}) {
  const [context, setContext] = useState<StockPipelineContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPipelineStockContext(pipelineId)
      .then((data) => {
        if (!cancelled) setContext(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ?? err?.message ?? "Failed to load stock context",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pipelineId]);

  const stockLinkParams = new URLSearchParams();
  const catalog = catalogUuidId ?? context?.catalog_uuid_id;
  if (catalog) stockLinkParams.set("catalog_id", catalog);
  if (customerId ?? context?.customer_id) {
    stockLinkParams.set("customer_id", String(customerId ?? context?.customer_id));
  }
  stockLinkParams.set("pipeline_id", pipelineId);
  const stockHref = `/stock/product-label?${stockLinkParams.toString()}`;

  if (loading) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading stock availability…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </div>
    );
  }

  if (!context) return null;

  const avail = context.availability;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-100 p-2">
            <Warehouse className="h-4 w-4 text-slate-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Stock & fulfillment</p>
            <p className="text-xs text-slate-500">
              Linked to PMS catalog
              {context.product_name ? `: ${context.product_name}` : ""}
            </p>
          </div>
        </div>
        <Link
          to={stockHref}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Record movement
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {context.quantity_exceeds_addis_stock ? (
        <div className="mx-4 mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            Deal quantity (
            {context.deal_quantity != null
              ? `${context.deal_quantity} ${context.deal_unit ?? "kg"}`
              : "—"}
            ) exceeds Addis Ababa available stock (
            {avail ? formatKg(avail.addis_ababa_available) : "—"}).
          </p>
        </div>
      ) : null}

      {avail ? (
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          <div className="rounded-lg bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">
              Addis available
            </p>
            <p className="text-lg font-bold text-emerald-900">
              {formatKg(avail.addis_ababa_available)}
            </p>
            <p className="text-[10px] text-emerald-700/80">
              On hand {formatKg(avail.addis_ababa_stock)}
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">
              SEZ Kenya
            </p>
            <p className="text-lg font-bold text-blue-900">
              {formatKg(avail.sez_kenya_available)}
            </p>
          </div>
          <div className="rounded-lg bg-violet-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-violet-700">
              Nairobi partner
            </p>
            <p className="text-lg font-bold text-violet-900">
              {formatKg(avail.nairobi_partner_available)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
              Total available
            </p>
            <p className="text-lg font-bold text-slate-900">
              {formatKg(avail.total_available)}
            </p>
            <p className="text-[10px] text-slate-500">
              {avail.stock_product_count} stock SKU
              {avail.stock_product_count === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600">
          <Package className="h-4 w-4" />
          No catalog product linked — link a product on this deal to see stock.
        </div>
      )}

      {context.recent_movements.length > 0 ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent movements for this deal
          </p>
          <ul className="space-y-1.5">
            {context.recent_movements.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="font-medium text-slate-800">
                  {m.date} · {locationLabel(m.location)}
                </span>
                <span className="text-slate-600">{movementSummary(m)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
