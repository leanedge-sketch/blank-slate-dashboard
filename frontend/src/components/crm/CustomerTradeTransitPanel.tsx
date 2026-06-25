import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Ship } from "lucide-react";
import {
  fetchImportShipmentsByClientName,
  fetchImportShipmentsForCustomer,
  type ImportShipmentRow,
} from "../../services/importFinance";
import { TRADE_TRANSIT_ROUTES } from "../../contexts/TradeTransitRequestContext";

function formatKg(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

export function CustomerTradeTransitPanel({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [shipments, setShipments] = useState<ImportShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let rows = await fetchImportShipmentsForCustomer(customerId, 10);
        if (rows.length === 0 && customerName.trim()) {
          rows = await fetchImportShipmentsByClientName(customerName, 10);
        }
        if (!cancelled) setShipments(rows);
      } catch {
        if (!cancelled) setShipments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, customerName]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Ship className="h-5 w-5 text-cyan-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Import shipments</h3>
            <p className="text-xs text-slate-500">Landed cost history for this customer</p>
          </div>
        </div>
        <Link
          to={TRADE_TRANSIT_ROUTES.tradeParameters}
          className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900"
        >
          New import costing
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading shipments…
        </div>
      ) : shipments.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          No saved import shipments for this customer yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shipments.map((row) => (
            <li key={row.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {formatKg(Number(row.quantity_kg))}
                  {row.request_ref ? ` · ${row.request_ref}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {row.status} ·{" "}
                  {row.created_at
                    ? new Date(row.created_at).toLocaleDateString()
                    : "—"}
                  {row.final_landed_unit_cost_etb_per_kg != null
                    ? ` · Landed ${Number(row.final_landed_unit_cost_etb_per_kg).toFixed(2)} ETB/kg`
                    : ""}
                </p>
              </div>
              <Link
                to={`${TRADE_TRANSIT_ROUTES.productCosting}?history=1`}
                className="text-xs font-medium text-slate-600 hover:text-cyan-700"
              >
                View in costing
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
