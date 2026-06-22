import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Database,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { useImportFinanceData } from "../../hooks/useImportFinanceData";
import { PmsCatalogProductSearch } from "../pms/PmsCatalogProductSearch";
import type { ChemicalFullData } from "../../services/api";
import {
  resolveImportFinanceProductId,
  type ImportFinanceProduct,
  type ImportShipmentRow,
} from "../../services/importFinance";
import { catalogProductValue } from "../../utils/catalogProducts";
import { chemicalSearchPrimaryLabel } from "../../utils/chemicalMasterColumns";
import type { FinanceConstants } from "../../utils/importFinanceCalc";
import { formatEtb, formatNumber } from "../../utils/importFinanceCalc";
import { EXPECTED_COST_2026_SCENARIOS } from "../../data/expectedCost2026Scenarios";
import { parseExpectedCostCsv } from "../../utils/expectedCostCsv";
import {
  calculateTradeTransit,
  customsRatesFromConstants,
  legacyShipmentToTradeTransit,
  tradeTransitToLegacyInputs,
  type TradeTransitInputs,
} from "../../utils/tradeTransitCalc";
import {
  applySharedRatesToLine,
  createTradeTransitLine,
  createTradeTransitRequest,
  scenariosToTradeTransitRequest,
  sharedRatesFromInputs,
  summarizeTradeTransitRequest,
  type TradeTransitRequest,
} from "../../utils/tradeTransitRequest";
import {
  DEFAULT_TRADE_TRANSIT_INPUTS,
  ImportFinanceCalculatorPanel,
} from "./ImportFinanceCalculatorPanel";
import { TradeTransitRequestSummaryTable } from "./trade-transit-hub/TradeTransitRequestSummaryTable";

export type TradeTransitWorkspaceSection = "trade" | "products" | "summary" | "all";

type ImportFinanceCalculatorWorkspaceProps = {
  enabled?: boolean;
  showRecentShipments?: boolean;
  activeSection?: TradeTransitWorkspaceSection;
  historyOnly?: boolean;
};

function marginTone(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "text-slate-500";
  if (pct < 0) return "text-rose-400 font-semibold";
  if (pct >= 15) return "text-emerald-400 font-semibold";
  return "text-amber-400 font-semibold";
}

const darkSelect =
  "w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50";

const darkInput =
  "w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500";

export function ImportFinanceCalculatorWorkspace({
  enabled = true,
  showRecentShipments = true,
  activeSection = "all",
  historyOnly = false,
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

  const [request, setRequest] = useState<TradeTransitRequest>(() =>
    createTradeTransitRequest(""),
  );
  const [activeLineId, setActiveLineId] = useState<string>(
    () => request.lines[0]?.id ?? "",
  );
  const [loadedShipmentId, setLoadedShipmentId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [csvScenarios, setCsvScenarios] = useState<
    ReturnType<typeof parseExpectedCostCsv>
  >([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const scenarioOptions = [
    ...EXPECTED_COST_2026_SCENARIOS,
    ...csvScenarios.filter(
      (s) => !EXPECTED_COST_2026_SCENARIOS.some((b) => b.id === s.id),
    ),
  ];

  const activeLine =
    request.lines.find((line) => line.id === activeLineId) ?? request.lines[0];

  const activeScenario = scenarioOptions.find((s) => s.id === selectedScenarioId);

  const summary = useMemo(
    () => summarizeTradeTransitRequest(request, constants),
    [request, constants],
  );

  useEffect(() => {
    setRequest((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => ({
        ...line,
        inputs: {
          ...line.inputs,
          ...customsRatesFromConstants(constants),
        },
      })),
    }));
  }, [constants]);

  useEffect(() => {
    if (!activeLine && request.lines[0]) {
      setActiveLineId(request.lines[0].id);
    }
  }, [activeLine, request.lines]);

  function updateActiveLine(
    patch: Partial<TradeTransitInputs> & {
      productName?: string;
      productId?: string | null;
      chemicalTypeId?: string | null;
    },
  ) {
    if (!activeLine) return;
    const { productName, productId, chemicalTypeId, ...inputPatch } = patch;
    setLoadedShipmentId(null);
    setSelectedScenarioId("");
    setRequest((prev) => ({
      ...prev,
      lines: prev.lines.map((line) =>
        line.id === activeLine.id
          ? {
              ...line,
              productName: productName ?? line.productName,
              productId: productId !== undefined ? productId : line.productId,
              chemicalTypeId:
                chemicalTypeId !== undefined ? chemicalTypeId : line.chemicalTypeId,
              inputs: { ...line.inputs, ...inputPatch },
            }
          : line,
      ),
    }));
  }

  function addProductLine() {
    const template = activeLine ?? request.lines[0];
    const shared = template
      ? sharedRatesFromInputs(template.inputs)
      : sharedRatesFromInputs(DEFAULT_TRADE_TRANSIT_INPUTS);
    const nextIndex = request.lines.length + 1;
    const line = applySharedRatesToLine(
      createTradeTransitLine(`Product ${nextIndex}`, {
        ...customsRatesFromConstants(constants),
      }),
      shared,
    );
    setRequest((prev) => ({
      ...prev,
      lines: [...prev.lines, line],
    }));
    setActiveLineId(line.id);
    setSelectedScenarioId("");
    setLoadedShipmentId(null);
  }

  function removeActiveLine() {
    if (request.lines.length <= 1) return;
    const nextLines = request.lines.filter((line) => line.id !== activeLineId);
    setRequest((prev) => ({ ...prev, lines: nextLines }));
    setActiveLineId(nextLines[0]?.id ?? "");
    setSelectedScenarioId("");
    setLoadedShipmentId(null);
  }

  function handlePmsProductSelect(chemical: ChemicalFullData) {
    const catalogId = catalogProductValue(chemical);
    const productName = chemicalSearchPrimaryLabel(chemical);
    const matchedFinance = products.find(
      (p) =>
        p.product_name.trim().toLowerCase() === productName.trim().toLowerCase(),
    );
    updateActiveLine({
      chemicalTypeId: catalogId,
      productName,
      productId: matchedFinance?.id ?? null,
      baseCustomsReferenceUsd: matchedFinance?.base_customs_reference_usd,
    });
  }

  function handlePmsProductClear() {
    updateActiveLine({
      chemicalTypeId: null,
      productId: null,
    });
  }

  function applyScenarioToActiveLine(
    scenario: (typeof scenarioOptions)[number],
  ) {
    if (!activeLine) return;
    setSelectedScenarioId(scenario.id);
    setLoadedShipmentId(null);
    setRequest((prev) => ({
      ...prev,
      lines: prev.lines.map((line) =>
        line.id === activeLine.id
          ? {
              ...line,
              productName: scenario.name,
              inputs: {
                ...line.inputs,
                ...scenario.inputs,
                ...customsRatesFromConstants(constants),
                bankChargePctOnCapital: scenario.inputs.bankChargePctOnCapital,
                profitTaxPctOnPreLanded: scenario.inputs.profitTaxPctOnPreLanded,
              },
            }
          : line,
      ),
    }));
  }

  function handleScenarioChange(scenarioId: string) {
    if (!scenarioId) {
      setSelectedScenarioId("");
      return;
    }
    const scenario = scenarioOptions.find((s) => s.id === scenarioId);
    if (scenario) applyScenarioToActiveLine(scenario);
  }

  function loadFullScenarioRequest(
    scenarios: Array<{ id: string; name: string; inputs: TradeTransitInputs }>,
    clientName: string,
  ) {
    const next = scenariosToTradeTransitRequest(scenarios, clientName);
    setRequest(next);
    setActiveLineId(next.lines[0]?.id ?? "");
    setSelectedScenarioId("");
    setLoadedShipmentId(null);
  }

  async function handleCsvUpload(file: File) {
    const text = await file.text();
    const parsed = parseExpectedCostCsv(text);
    if (parsed.length === 0) {
      alert(
        "Could not read product columns from this CSV. Use the Expected cost workbook format (product names in row 3).",
      );
      return;
    }
    setCsvScenarios(parsed);
    const clientName =
      request.clientName.trim() ||
      file.name.replace(/\.csv$/i, "").trim() ||
      "Imported client";
    loadFullScenarioRequest(parsed, clientName);
  }

  function loadExpectedCost2026Sample() {
    loadFullScenarioRequest(
      EXPECTED_COST_2026_SCENARIOS,
      request.clientName.trim() || "2026 Expected cost",
    );
  }

  function handleLoadShipment(row: ImportShipmentRow) {
    const product = products.find((p) => p.id === row.product_id);
    const line = createTradeTransitLine(product?.product_name ?? "Loaded product", {
      ...legacyShipmentToTradeTransit(row),
      productId: row.product_id,
      chemicalTypeId: row.chemical_type_id ?? null,
    });
    setRequest((prev) => ({
      ...prev,
      lines: [line],
    }));
    setActiveLineId(line.id);
    setSelectedScenarioId("");
    setLoadedShipmentId(row.id);
  }

  async function handleSaveDraft() {
    const clientLabel = request.clientName.trim() || "Unnamed client";
    const unlinked = request.lines.filter((line) => !line.chemicalTypeId);
    if (unlinked.length > 0) {
      const names = unlinked.map((l) => l.productName).join(", ");
      const proceed = window.confirm(
        `${unlinked.length} product(s) are not linked to PMS catalog (${names}). Save the ${request.lines.length - unlinked.length} linked line(s) only?`,
      );
      if (!proceed) return;
    }

    const linkedLines = request.lines.filter((line) => line.chemicalTypeId);
    if (linkedLines.length === 0) {
      alert("Pick at least one product from the PMS catalog before saving.");
      return;
    }

    const missingCustomsRef = linkedLines.filter(
      (line) => !line.inputs.baseCustomsReferenceUsd || line.inputs.baseCustomsReferenceUsd <= 0,
    );
    if (missingCustomsRef.length > 0) {
      alert(
        `Set customs reference (USD/kg) for: ${missingCustomsRef.map((l) => l.productName).join(", ")}`,
      );
      return;
    }

    try {
      let financeProducts = products;
      for (const line of linkedLines) {
        let productId = line.productId;
        if (!productId) {
          const resolved = await resolveImportFinanceProductId(
            financeProducts,
            line.productName,
            line.inputs.baseCustomsReferenceUsd,
          );
          productId = resolved.id;
          if (!financeProducts.some((p) => p.id === resolved.id)) {
            financeProducts = [...financeProducts, resolved];
          }
        }

        const legacyInputs = tradeTransitToLegacyInputs(
          line.inputs,
          calculateTradeTransit(line.inputs, constants),
        );
        await saveDraft(productId, legacyInputs, constants, {
          clientName: clientLabel,
          requestRef: request.requestRef,
          chemicalTypeId: line.chemicalTypeId,
        });
      }
      alert(
        `Saved ${linkedLines.length} pipeline line(s) for client "${clientLabel}".`,
      );
    } catch {
      /* error banner */
    }
  }

  if (!activeLine) {
    return null;
  }

  const showTrade =
    activeSection === "all" || activeSection === "trade";
  const showProducts =
    activeSection === "all" || activeSection === "products";
  const showSummary =
    activeSection === "all" || activeSection === "summary";
  const showTooling = showProducts && !historyOnly;
  const showCalculator = showProducts && !historyOnly;
  const showShipments =
    showRecentShipments &&
    (historyOnly ||
      (shipments.length > 0 &&
        (activeSection === "all" || activeSection === "products")));

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

      {showTrade && (
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
              <Building2 className="h-3.5 w-3.5 text-cyan-500" />
              Client
            </label>
            <input
              type="text"
              value={request.clientName}
              onChange={(e) =>
                setRequest((prev) => ({ ...prev, clientName: e.target.value }))
              }
              placeholder="Customer / buyer name"
              className={darkInput}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
              Request ref
            </label>
            <input
              type="text"
              value={request.requestRef}
              onChange={(e) =>
                setRequest((prev) => ({ ...prev, requestRef: e.target.value }))
              }
              placeholder="PO / quote # (optional)"
              className={darkInput}
            />
          </div>
          <button
            type="button"
            onClick={loadExpectedCost2026Sample}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200 hover:bg-emerald-500/20 transition"
          >
            <Users className="h-4 w-4" />
            Load 2026 sample (2 products)
          </button>
        </div>
      </div>
      )}

      {showProducts && (
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-full sm:w-auto sm:mr-2">
            Products on this request
          </p>
          {request.lines.map((line) => {
            const lineResult = summary.lines.find((s) => s.lineId === line.id);
            const isActive = line.id === activeLineId;
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => {
                  setActiveLineId(line.id);
                  setSelectedScenarioId("");
                }}
                className={`rounded-lg px-3 py-2 text-left text-sm border transition ${
                  isActive
                    ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-slate-900/80 text-slate-300 hover:border-white/20"
                }`}
              >
                <span className="font-medium block">{line.productName}</span>
                <span className="text-[10px] tabular-nums text-slate-500">
                  {line.inputs.quantityKg.toLocaleString()} kg
                  {lineResult
                    ? ` · ${formatNumber(lineResult.result.stage3.finalLandedUnitCostEtbPerKg, 2)} ETB/kg`
                    : ""}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={addProductLine}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 transition"
          >
            <Plus className="h-4 w-4" />
            Add product
          </button>
          {request.lines.length > 1 && (
            <button
              type="button"
              onClick={removeActiveLine}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 px-3 py-2 text-sm text-rose-300/90 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="h-4 w-4" />
              Remove active
            </button>
          )}
        </div>
      </div>
      )}

      {showSummary && (
        <TradeTransitRequestSummaryTable
          clientName={request.clientName}
          summary={summary}
          fullPanel={activeSection === "summary"}
        />
      )}

      {showTooling && (
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <div className="min-w-[200px] flex-1">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            Scenario for active product
          </label>
          <select
            value={selectedScenarioId}
            onChange={(e) => handleScenarioChange(e.target.value)}
            className={darkSelect}
          >
            <option value="">Custom inputs…</option>
            {scenarioOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.inputs.quantityKg.toLocaleString()} kg)
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[240px] flex-[2]">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
            <Database className="h-3.5 w-3.5 text-cyan-500" />
            PMS product (active line)
          </label>
          <PmsCatalogProductSearch
            value={activeLine.chemicalTypeId}
            onSelect={handlePmsProductSelect}
            onClear={handlePmsProductClear}
            disabled={loading}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-400">Import CSV</span>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCsvUpload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-300 hover:border-emerald-500/30 hover:text-emerald-300 transition"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Upload workbook
          </button>
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
            disabled={saving || Boolean(setupHint)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] disabled:opacity-50 transition"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save all linked lines
          </button>
        </div>
      </div>
      )}

      {showCalculator && activeScenario && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-slate-400">
          <p className="font-medium text-emerald-200/90">
            Scenario on {activeLine.productName}: {activeScenario.name}
          </p>
          <p className="mt-1 tabular-nums text-slate-500">
            Calculator — landed{" "}
            {formatNumber(
              calculateTradeTransit(activeLine.inputs, constants).stage3
                .finalLandedUnitCostEtbPerKg,
              2,
            )}{" "}
            ETB/kg
          </p>
        </div>
      )}

      {showCalculator && loadedShipmentId && (
        <p className="text-xs text-cyan-400/90">
          Loaded snapshot {loadedShipmentId.slice(0, 8)}… into single-product
          request — add more products or save linked lines.
        </p>
      )}

      {showCalculator && (
      <ImportFinanceCalculatorPanel
        key={activeLine.id}
        inputs={activeLine.inputs}
        onChange={updateActiveLine}
        constants={constants as FinanceConstants}
      />
      )}

      {showShipments && (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Saved pipeline snapshots
            <span className="ml-2 text-xs font-normal text-slate-500">
              click to load one product
            </span>
          </h3>
          {shipments.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No saved snapshots yet. Complete a calculation and use Save all
              linked lines.
            </p>
          ) : (
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
                      isLoaded ? "bg-cyan-500/10" : "hover:bg-white/5"
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
          )}
        </div>
      )}
    </div>
  );
}
