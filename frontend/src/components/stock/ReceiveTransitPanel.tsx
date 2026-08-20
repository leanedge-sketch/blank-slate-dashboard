import { useEffect, useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import {
  createStockMovement,
  fetchStockProducts,
} from "../../services/api";
import {
  fetchRecentImportShipments,
  markImportShipmentReceived,
  type ImportShipmentRow,
} from "../../services/importFinance";
import { PROCUREMENT_PIPELINE_DOMAIN } from "../../lib/pipelineDomains";

const IN_TRANSIT = new Set(["in_transit", "in transit", "ocean transit"]);

export function ReceiveTransitPanel() {
  const [rows, setRows] = useState<ImportShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const all = await fetchRecentImportShipments(40, {
        pipelineDomain: PROCUREMENT_PIPELINE_DOMAIN,
      });
      setRows(
        all.filter((row) => IN_TRANSIT.has(String(row.status || "").toLowerCase())),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function receive(row: ImportShipmentRow) {
    setBusyId(row.id);
    setMessage(null);
    try {
      const catalogId = row.chemical_type_id?.trim();
      if (!catalogId) {
        throw new Error("This shipment has no catalog product to receive against.");
      }
      const products = await fetchStockProducts({ limit: 1000 });
      const stockSku = products.products.find(
        (p) => String(p.catalog_uuid_id || "") === catalogId,
      );
      if (!stockSku) {
        throw new Error("Create a stock SKU linked to this catalog product first.");
      }
      const qty = Number(row.quantity_kg) || 0;
      if (qty <= 0) {
        throw new Error("This shipment has no quantity to receive.");
      }
      await createStockMovement({
        product_id: stockSku.id,
        date: new Date().toISOString().slice(0, 10),
        location: "addis_ababa",
        transaction_type: "Purchase",
        unit: "kg",
        purchase_kg: qty,
        catalog_uuid_id: catalogId,
        reference: row.request_ref || row.id,
        remark: `Received from transit shipment ${row.id}`,
      });
      await markImportShipmentReceived(row.id);
      setMessage(`Received ${row.quantity_kg} kg into Addis Ababa.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Receive failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-100">
      <div className="mb-3 flex items-center gap-2">
        <PackageCheck className="h-4 w-4 text-amber-300" />
        <h3 className="text-sm font-semibold">Receive in-transit shipments</h3>
      </div>
      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking Trade & Transit…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No in-transit shipments to receive.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
            >
              <span>
                {row.quantity_kg} kg
                {row.client_name ? ` · ${row.client_name}` : ""}
                {row.request_ref ? ` · ${row.request_ref}` : ""}
              </span>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void receive(row)}
                className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 disabled:opacity-50"
              >
                {busyId === row.id ? "Receiving…" : "Receive"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message ? <p className="mt-3 text-xs text-amber-200">{message}</p> : null}
    </section>
  );
}
