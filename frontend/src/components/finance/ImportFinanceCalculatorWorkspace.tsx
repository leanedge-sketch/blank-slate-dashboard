import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useImportFinanceData } from "../../hooks/useImportFinanceData";
import type { ImportFinanceProduct } from "../../services/importFinance";
import type { FinanceConstants, ImportFinanceInputs } from "../../utils/importFinanceCalc";
import {
  DEFAULT_IMPORT_FINANCE_INPUTS,
  ImportFinanceCalculatorPanel,
} from "./ImportFinanceCalculatorPanel";

type ImportFinanceCalculatorWorkspaceProps = {
  enabled?: boolean;
  showRecentShipments?: boolean;
};

export function ImportFinanceCalculatorWorkspace({
  enabled = true,
  showRecentShipments = true,
}: ImportFinanceCalculatorWorkspaceProps) {
  const {
    constants,
    products,
    shipments,
    loading,
    saving,
    error,
    setupHint,
    reload,
    saveDraft,
  } = useImportFinanceData(enabled);

  const [inputs, setInputs] = useState<ImportFinanceInputs>(
    DEFAULT_IMPORT_FINANCE_INPUTS,
  );
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      const first = products[0];
      setSelectedProductId(first.id);
      setInputs((prev) => ({
        ...prev,
        baseCustomsReferenceUsd: first.base_customs_reference_usd,
      }));
    }
  }, [products, selectedProductId]);

  function handleProductChange(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      setInputs((prev) => ({
        ...prev,
        baseCustomsReferenceUsd: product.base_customs_reference_usd,
      }));
    }
  }

  async function handleSaveDraft() {
    if (!selectedProductId) {
      alert("Select a product from the database before saving.");
      return;
    }
    try {
      const row = await saveDraft(selectedProductId, inputs);
      alert(`Saved draft shipment ${row.id.slice(0, 8)}…`);
    } catch {
      /* error state shown in banner */
    }
  }

  return (
    <div className="space-y-4">
      {(error || setupHint) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Database connection</p>
          <p className="mt-1">{setupHint ?? error}</p>
          {!setupHint && (
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-2 text-xs font-semibold text-amber-800 underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Product (from database)
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => handleProductChange(e.target.value)}
            disabled={loading || products.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
          >
            <option value="">
              {loading
                ? "Loading products…"
                : products.length === 0
                  ? "No products — run SQL seed"
                  : "Select product…"}
            </option>
            {products.map((p: ImportFinanceProduct) => (
              <option key={p.id} value={p.id}>
                {p.product_name} (ref {p.base_customs_reference_usd} USD/kg)
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={saving || !selectedProductId || Boolean(setupHint)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save draft shipment
          </button>
        </div>
      </div>

      <ImportFinanceCalculatorPanel
        inputs={inputs}
        onChange={(patch) => setInputs((prev) => ({ ...prev, ...patch }))}
        constants={constants as FinanceConstants}
      />

      {showRecentShipments && shipments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">
            Recent saved shipments
          </h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {shipments.map((s) => {
              const product = products.find((p) => p.id === s.product_id);
              return (
                <li key={s.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {product?.product_name ?? s.product_id.slice(0, 8)} ·{" "}
                    {Number(s.quantity_kg).toLocaleString()} kg
                  </span>
                  <span className="text-slate-400">
                    {s.status} · {new Date(s.created_at).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
