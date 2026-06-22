import { useEffect, useState } from "react";
import { Database, Loader2, RefreshCw, Save } from "lucide-react";
import { useImportFinanceData } from "../../hooks/useImportFinanceData";
import type { ImportFinanceProduct, ImportShipmentRow } from "../../services/importFinance";
import type { FinanceConstants } from "../../utils/importFinanceCalc";
import { formatEtb, formatNumber } from "../../utils/importFinanceCalc";
import {
  calculateTradeTransit,
  customsRatesFromConstants,
  legacyShipmentToTradeTransit,
  tradeTransitToLegacyInputs,
  type TradeTransitInputs,
} from "../../utils/tradeTransitCalc";
import {
  DEFAULT_TRADE_TRANSIT_INPUTS,
  ImportFinanceCalculatorPanel,
} from "./ImportFinanceCalculatorPanel";

type ImportFinanceCalculatorWorkspaceProps = {
  enabled?: boolean;
  showRecentShipments?: boolean;
};

function marginTone(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "text-slate-500";
  if (pct < 0) return "text-rose-400 font-semibold";
  if (pct >= 15) return "text-emerald-400 font-semibold";
  return "text-amber-400 font-semibold";
}

const darkSelect =
  "w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50";

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

  const [inputs, setInputs] = useState<TradeTransitInputs>(
    DEFAULT_TRADE_TRANSIT_INPUTS,
  );
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [loadedShipmentId, setLoadedShipmentId] = useState<string | null>(null);

  useEffect(() => {
    setInputs((prev) => ({
      ...prev,
      ...customsRatesFromConstants(constants),
    }));
  }, [constants]);

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
    setLoadedShipmentId(null);
    const product = products.find((p) => p.id === productId);
    if (product) {
      setInputs((prev) => ({
        ...prev,
        baseCustomsReferenceUsd: product.base_customs_reference_usd,
      }));
    }
  }

  function handleLoadShipment(row: ImportShipmentRow) {
    setSelectedProductId(row.product_id);
    setInputs(legacyShipmentToTradeTransit(row));
    setLoadedShipmentId(row.id);
  }

  async function handleSaveDraft() {
    if (!selectedProductId) {
      alert("Select a product from the database before saving.");
      return;
    }
    try {
      const legacyInputs = tradeTransitToLegacyInputs(
        inputs,
        calculateTradeTransit(inputs, constants),
      );
      const row = await saveDraft(selectedProductId, legacyInputs, constants);
      setLoadedShipmentId(row.id);
      alert(
        `Pipeline snapshot saved.\n` +
          `Landed: ${formatNumber(Number(row.final_landed_unit_cost_etb_per_kg ?? 0), 2)} ETB/kg · ` +
          `Margin: ${formatNumber(Number(row.gross_margin_pct ?? 0), 1)}%`,
      );
    } catch {
      /* error state shown in banner */
    }
  }

  return (
    <div className="space-y-6">
      {(error || setupHint) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium text-amber-100">Database connection</p>
          <p className="mt-1 text-amber-200/90">{setupHint ?? error}</p>
          {!setupHint && (
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-2 text-xs font-semibold text-cyan-400 underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <div className="min-w-[220px] flex-1">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
            <Database className="h-3.5 w-3.5 text-cyan-500" />
            Product (Supabase)
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => handleProductChange(e.target.value)}
            disabled={loading || products.length === 0}
            className={darkSelect}
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
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-300 hover:border-cyan-500/30 hover:text-cyan-300 disabled:opacity-50 transition"
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
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] disabled:opacity-50 transition"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save pipeline to database
          </button>
        </div>
      </div>

      {loadedShipmentId && (
        <p className="text-xs text-cyan-400/90">
          Loaded snapshot {loadedShipmentId.slice(0, 8)}… — edit and save to
          write a new row.
        </p>
      )}

      <ImportFinanceCalculatorPanel
        inputs={inputs}
        onChange={(patch) => {
          setLoadedShipmentId(null);
          setInputs((prev) => ({ ...prev, ...patch }));
        }}
        constants={constants as FinanceConstants}
      />

      {showRecentShipments && shipments.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Saved pipeline snapshots
            <span className="ml-2 text-xs font-normal text-slate-500">
              click to load
            </span>
          </h3>
          <table className="w-full min-w-[720px] text-sm text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium text-right">Qty</th>
                <th className="py-2 pr-3 font-medium text-right">Capital</th>
                <th className="py-2 pr-3 font-medium text-right">Customs</th>
                <th className="py-2 pr-3 font-medium text-right">Landed/kg</th>
                <th className="py-2 pr-3 font-medium text-right">Target/kg</th>
                <th className="py-2 pr-3 font-medium text-right">Margin</th>
                <th className="py-2 pr-3 font-medium text-right">Revenue</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => {
                const product = products.find((p) => p.id === s.product_id);
                const isLoaded = loadedShipmentId === s.id;
                return (
                  <tr
                    key={s.id}
                    onClick={() => handleLoadShipment(s)}
                    className={`border-b border-white/5 cursor-pointer transition ${
                      isLoaded
                        ? "bg-cyan-500/10"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <td className="py-2.5 pr-3 text-slate-200">
                      {product?.product_name ?? s.product_id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                      {Number(s.quantity_kg).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                      {s.capital_outlay_etb != null
                        ? formatEtb(Number(s.capital_outlay_etb), 0)
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                      {s.total_customs_paid_etb != null
                        ? formatEtb(Number(s.total_customs_paid_etb), 0)
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-emerald-400">
                      {s.final_landed_unit_cost_etb_per_kg != null
                        ? formatNumber(
                            Number(s.final_landed_unit_cost_etb_per_kg),
                            2,
                          )
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                      {s.target_selling_price_etb_per_kg != null
                        ? formatNumber(
                            Number(s.target_selling_price_etb_per_kg),
                            2,
                          )
                        : "—"}
                    </td>
                    <td
                      className={`py-2.5 pr-3 text-right tabular-nums ${marginTone(
                        s.gross_margin_pct != null
                          ? Number(s.gross_margin_pct)
                          : null,
                      )}`}
                    >
                      {s.gross_margin_pct != null
                        ? `${formatNumber(Number(s.gross_margin_pct), 1)}%`
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-400">
                      {s.total_expected_revenue_etb != null
                        ? formatEtb(Number(s.total_expected_revenue_etb), 0)
                        : "—"}
                    </td>
                    <td className="py-2.5 text-slate-500 text-xs">{s.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
