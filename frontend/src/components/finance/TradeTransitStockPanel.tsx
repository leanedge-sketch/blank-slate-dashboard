import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, Warehouse } from "lucide-react";
import { fetchStockAvailabilityByCatalog } from "../../services/api";

function formatKg(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
}

export function TradeTransitStockPanel({
  chemicalTypeId,
  quantityKg,
  customerId,
  productName,
}: {
  chemicalTypeId: string | null;
  quantityKg?: number;
  customerId?: string | null;
  productName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avail, setAvail] = useState<Awaited<
    ReturnType<typeof fetchStockAvailabilityByCatalog>
  > | null>(null);

  useEffect(() => {
    if (!chemicalTypeId) {
      setAvail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStockAvailabilityByCatalog(chemicalTypeId)
      .then((data) => {
        if (!cancelled) setAvail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ?? err?.message ?? "Failed to load stock",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chemicalTypeId]);

  if (!chemicalTypeId) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
        Link a PMS catalog product to see stock availability for this line.
      </div>
    );
  }

  const stockParams = new URLSearchParams();
  stockParams.set("catalog_id", chemicalTypeId);
  if (customerId) stockParams.set("customer_id", customerId);
  const stockHref = `/stock/product-label?${stockParams.toString()}`;

  const exceedsAddis =
    quantityKg != null &&
    quantityKg > 0 &&
    avail != null &&
    quantityKg > avail.addis_ababa_available;

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-cyan-400" />
          <div>
            <p className="text-sm font-semibold text-white">Stock (PMS catalog)</p>
            <p className="text-xs text-slate-400">
              {productName || avail?.product_name || "Linked product"}
            </p>
          </div>
        </div>
        <Link
          to={stockHref}
          className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
        >
          Stock module
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading availability…
        </div>
      ) : error ? (
        <p className="px-4 py-3 text-sm text-rose-300">{error}</p>
      ) : avail ? (
        <>
          {exceedsAddis ? (
            <div className="mx-4 mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Transit quantity ({formatKg(quantityKg!)}) exceeds Addis available (
              {formatKg(avail.addis_ababa_available)}).
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2">
              <p className="text-[10px] font-medium uppercase text-emerald-300/80">
                Addis available
              </p>
              <p className="text-lg font-bold text-emerald-200">
                {formatKg(avail.addis_ababa_available)}
              </p>
            </div>
            <div className="rounded-lg bg-blue-500/10 px-3 py-2">
              <p className="text-[10px] font-medium uppercase text-blue-300/80">SEZ Kenya</p>
              <p className="text-lg font-bold text-blue-200">
                {formatKg(avail.sez_kenya_available)}
              </p>
            </div>
            <div className="rounded-lg bg-violet-500/10 px-3 py-2">
              <p className="text-[10px] font-medium uppercase text-violet-300/80">Nairobi</p>
              <p className="text-lg font-bold text-violet-200">
                {formatKg(avail.nairobi_partner_available)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/80 px-3 py-2">
              <p className="text-[10px] font-medium uppercase text-slate-400">Total</p>
              <p className="text-lg font-bold text-white">
                {formatKg(avail.total_available)}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
