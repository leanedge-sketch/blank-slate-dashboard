import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { fetchStockProducts, type Product } from "../../services/api";
import { getSupabase } from "../../lib/supabase";

type WarehouseLocation = "addis_ababa" | "sez_kenya" | "nairobi_partner";

const LOCATION_OPTIONS: Array<{ value: WarehouseLocation; label: string }> = [
  { value: "addis_ababa", label: "Addis Ababa" },
  { value: "sez_kenya", label: "SEZ Kenya" },
  { value: "nairobi_partner", label: "Nairobi Partner" },
];

interface TransferModalProps {
  isOpen: boolean;
  defaultProductId?: string | null;
  onClose: () => void;
  onTransferred?: () => void;
}

export function TransferModal({
  isOpen,
  defaultProductId,
  onClose,
  onTransferred,
}: TransferModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    product_id: defaultProductId ?? "",
    source_location: "sez_kenya" as WarehouseLocation,
    dest_location: "addis_ababa" as WarehouseLocation,
    quantity: "",
    batch_id: "",
    expiry_date: "",
    notes: "Internal Transfer",
  });

  useEffect(() => {
    if (!isOpen) return;
    setForm((prev) => ({
      ...prev,
      product_id: defaultProductId ?? prev.product_id,
    }));
  }, [defaultProductId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadProducts() {
      try {
        setLoadingProducts(true);
        const res = await fetchStockProducts({ limit: 1000 });
        if (!cancelled) {
          setProducts(res.products);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stock products.");
        }
      } finally {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.product_id) ?? null,
    [form.product_id, products],
  );

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const quantity = Number(form.quantity);
    if (!form.product_id) {
      setError("Select a product to transfer.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a transfer quantity greater than 0.");
      return;
    }
    if (!form.batch_id.trim()) {
      setError("Batch ID is required for transfer traceability.");
      return;
    }
    if (!form.expiry_date) {
      setError("Expiry date is required for transfer traceability.");
      return;
    }
    if (form.source_location === form.dest_location) {
      setError("Source and destination locations must differ.");
      return;
    }

    try {
      setSubmitting(true);
      const { error: rpcError } = await getSupabase().rpc("atomic_stock_transfer", {
        p_product_id: form.product_id,
        p_source_location: form.source_location,
        p_dest_location: form.dest_location,
        p_quantity: quantity,
        p_batch_id: form.batch_id.trim(),
        p_expiry_date: form.expiry_date,
        p_notes: form.notes.trim() || "Internal Transfer",
      });

      if (rpcError) throw rpcError;

      setSuccess("Transfer posted atomically.");
      setForm((prev) => ({
        ...prev,
        quantity: "",
        batch_id: "",
        expiry_date: "",
        notes: "Internal Transfer",
      }));
      onTransferred?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Transfer Stock</h2>
            <p className="text-sm text-slate-500">
              Uses `atomic_stock_transfer` so source and destination stay in one database transaction.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Product *</label>
              <select
                value={form.product_id}
                onChange={(e) => setForm((prev) => ({ ...prev, product_id: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loadingProducts || submitting}
                required
              >
                <option value="">-- Select product --</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.chemical} - {product.brand}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Source Location *</label>
              <select
                value={form.source_location}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    source_location: e.target.value as WarehouseLocation,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
                required
              >
                {LOCATION_OPTIONS.map((location) => (
                  <option key={location.value} value={location.value}>
                    {location.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Destination Location *</label>
              <select
                value={form.dest_location}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    dest_location: e.target.value as WarehouseLocation,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
                required
              >
                {LOCATION_OPTIONS.map((location) => (
                  <option key={location.value} value={location.value}>
                    {location.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Quantity (kg) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Batch ID *</label>
              <input
                type="text"
                value={form.batch_id}
                onChange={(e) => setForm((prev) => ({ ...prev, batch_id: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
                placeholder="FIFO batch / lot"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Expiry Date *</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm((prev) => ({ ...prev, expiry_date: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              />
            </div>
          </div>

          {selectedProduct ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Current available: Addis {selectedProduct.available_stock_addis_ababa.toFixed(2)} kg, SEZ{" "}
              {selectedProduct.available_stock_sez_kenya.toFixed(2)} kg, Nairobi{" "}
              {selectedProduct.available_stock_nairobi_partner.toFixed(2)} kg.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-200 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingProducts}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
