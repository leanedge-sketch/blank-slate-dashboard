import { useEffect, useMemo, useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import { createStockMovement, fetchStockProducts, type Product } from "../../services/api";
import {
  fetchRecentImportShipments,
  markImportShipmentReceived,
  type ImportShipmentRow,
} from "../../services/importFinance";
import { PROCUREMENT_PIPELINE_DOMAIN } from "../../lib/pipelineDomains";

type WarehouseLocation = "addis_ababa" | "sez_kenya" | "nairobi_partner";

const ARRIVED_STATUSES = new Set(["arrived"]);
const LOCATION_OPTIONS: Array<{ value: WarehouseLocation; label: string }> = [
  { value: "addis_ababa", label: "Addis Ababa" },
  { value: "sez_kenya", label: "SEZ Kenya" },
  { value: "nairobi_partner", label: "Nairobi Partner" },
];

interface ReceiveFormState {
  warehouse: WarehouseLocation;
  batch_id: string;
  expiry_date: string;
}

export function ReceiveTransitShipment() {
  const [rows, setRows] = useState<ImportShipmentRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, ReceiveFormState>>({});

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products) {
      if (product.catalog_uuid_id) {
        map.set(String(product.catalog_uuid_id), product);
      }
    }
    return map;
  }, [products]);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const [shipments, productRes] = await Promise.all([
        fetchRecentImportShipments(60, { pipelineDomain: PROCUREMENT_PIPELINE_DOMAIN }),
        fetchStockProducts({ limit: 1000 }),
      ]);

      const arrivedRows = shipments.filter((row) =>
        ARRIVED_STATUSES.has(String(row.status || "").trim().toLowerCase()),
      );
      setRows(arrivedRows);
      setProducts(productRes.products);
      setForms((prev) => {
        const next = { ...prev };
        for (const row of arrivedRows) {
          next[row.id] ??= {
            warehouse: "addis_ababa",
            batch_id: "",
            expiry_date: "",
          };
        }
        return next;
      });
    } catch (err) {
      setRows([]);
      setProducts([]);
      setMessage(err instanceof Error ? err.message : "Failed to load arrived shipments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function setRowForm(shipmentId: string, patch: Partial<ReceiveFormState>) {
    setForms((prev) => ({
      ...prev,
      [shipmentId]: {
        ...prev[shipmentId],
        warehouse: prev[shipmentId]?.warehouse ?? "addis_ababa",
        batch_id: prev[shipmentId]?.batch_id ?? "",
        expiry_date: prev[shipmentId]?.expiry_date ?? "",
        ...patch,
      },
    }));
  }

  async function receive(row: ImportShipmentRow) {
    const form = forms[row.id];
    if (!form) return;

    setBusyId(row.id);
    setMessage(null);
    try {
      const catalogId = row.chemical_type_id?.trim();
      if (!catalogId) {
        throw new Error("This shipment is not linked to a product catalog item.");
      }

      const stockSku = productMap.get(catalogId);
      if (!stockSku) {
        throw new Error("Create a stock SKU linked to this catalog product before receiving.");
      }

      const qty = Number(row.quantity_kg) || 0;
      if (qty <= 0) {
        throw new Error("This shipment has no quantity to receive.");
      }
      if (!form.batch_id.trim()) {
        throw new Error("Batch ID is required for inbound stock.");
      }
      if (!form.expiry_date) {
        throw new Error("Expiry date is required for inbound stock.");
      }

      await createStockMovement({
        product_id: stockSku.id,
        date: new Date().toISOString().slice(0, 10),
        location: form.warehouse,
        transaction_type: "Purchase",
        unit: "kg",
        purchase_kg: qty,
        catalog_uuid_id: catalogId,
        reference: row.request_ref || row.id,
        remark: `Received from arrived procurement shipment ${row.id}`,
        batch_id: form.batch_id.trim(),
        expiry_date: form.expiry_date,
      });

      await markImportShipmentReceived(row.id);
      setMessage(`Received ${qty} kg into ${form.warehouse.replace("_", " ")}.`);
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
        <h3 className="text-sm font-semibold">Receive arrived procurement shipments</h3>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Pulls deterministic procurement rows with status `arrived`, then posts one inbound stock
        movement after warehouse, batch, and expiry are confirmed.
      </p>

      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading arrived shipments…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No arrived procurement shipments waiting to be received.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const form = forms[row.id] ?? {
              warehouse: "addis_ababa",
              batch_id: "",
              expiry_date: "",
            };
            const linkedSku = row.chemical_type_id ? productMap.get(String(row.chemical_type_id)) : undefined;

            return (
              <div
                key={row.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">
                      {row.request_ref || row.id} · {row.quantity_kg} kg
                    </p>
                    <p className="text-slate-400">
                      {row.client_name || "Unknown client"}
                      {linkedSku ? ` · Stock SKU: ${linkedSku.chemical} - ${linkedSku.brand}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    {row.status}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Receiving warehouse *
                    </label>
                    <select
                      value={form.warehouse}
                      onChange={(e) =>
                        setRowForm(row.id, { warehouse: e.target.value as WarehouseLocation })
                      }
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
                      disabled={busyId === row.id}
                    >
                      {LOCATION_OPTIONS.map((location) => (
                        <option key={location.value} value={location.value}>
                          {location.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Batch ID *</label>
                    <input
                      type="text"
                      value={form.batch_id}
                      onChange={(e) => setRowForm(row.id, { batch_id: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
                      placeholder="Inbound lot"
                      disabled={busyId === row.id}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Expiry date *</label>
                    <input
                      type="date"
                      value={form.expiry_date}
                      onChange={(e) => setRowForm(row.id, { expiry_date: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
                      disabled={busyId === row.id}
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => void receive(row)}
                      disabled={busyId === row.id || !linkedSku}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Receive into Stock
                    </button>
                  </div>
                </div>

                {!linkedSku ? (
                  <p className="mt-3 text-xs text-amber-300">
                    No stock SKU is linked to this catalog product yet.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {message ? <p className="mt-3 text-xs text-amber-200">{message}</p> : null}
    </section>
  );
}
