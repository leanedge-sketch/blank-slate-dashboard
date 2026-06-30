import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  AlertTriangle,
  Check,
  FileSpreadsheet,
  Link2,
  Package,
  Search,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { useProductCatalog } from "../../../contexts/ProductCatalogContext";
import {
  fetchCustomers,
  type ChemicalFullData,
  type Customer,
} from "../../../services/api";
import {
  ensurePipelineRequestIds,
  generatePipelineRequestRef,
  validatePipelineRequestFields,
} from "../../../types/tradeParameters";
import type {
  ExpectedCostScenario,
  WorkbookImportMetadata,
} from "../../../utils/expectedCostCsv";
import type { TradeTransitInputs } from "../../../utils/tradeTransitCalc";
import {
  DEFAULT_TRADE_TRANSIT_INPUTS,
  customsRatesFromConstants,
} from "../../../utils/tradeTransitCalc";
import { DEFAULT_FINANCE_CONSTANTS, formatNumber } from "../../../utils/importFinanceCalc";
import { catalogProductValue, findCatalogProduct } from "../../../utils/catalogProducts";
import { chemicalSearchPrimaryLabel } from "../../../utils/chemicalMasterColumns";
import {
  createTradeTransitLineId,
  sharedRatesFromInputs,
  type SharedTradeTransitRates,
} from "../../../utils/tradeTransitRequest";
import {
  bestCatalogMatch,
  suggestCatalogProducts,
} from "../../../utils/workbookProductMatch";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

export type WorkbookImportDraft = {
  customerId: string;
  clientName: string;
  contactPerson: string;
  requestDate: string;
  requestRef: string;
};

export type WorkbookImportLineDraft = {
  id: string;
  workbookName: string;
  productName: string;
  chemicalTypeId: string | null;
  quantityKg: number;
  inputs: TradeTransitInputs;
  expected: ExpectedCostScenario["expected"];
};

export type WorkbookImportConfirmPayload = {
  draft: WorkbookImportDraft;
  lines: WorkbookImportLineDraft[];
};

type WorkbookImportReviewModalProps = {
  fileName: string;
  scenarios: ExpectedCostScenario[];
  metadata: WorkbookImportMetadata;
  initial: WorkbookImportDraft;
  onConfirm: (payload: WorkbookImportConfirmPayload) => void;
  onCancel: () => void;
};

type ReviewTab = "request" | string;

function sortCustomers(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) =>
    (a.customer_name || "").localeCompare(b.customer_name || "", undefined, {
      sensitivity: "base",
    }),
  );
}

function linePatchFromChemical(
  line: WorkbookImportLineDraft,
  chemical: ChemicalFullData,
): Partial<WorkbookImportLineDraft> {
  const productName = chemicalSearchPrimaryLabel(chemical);
  const costUsd =
    typeof chemical.current_cost === "number" && chemical.current_cost > 0
      ? chemical.current_cost
      : typeof chemical.price === "number" && chemical.price > 0
        ? chemical.price
        : null;

  return {
    chemicalTypeId: catalogProductValue(chemical),
    productName,
    inputs: {
      ...line.inputs,
      ...(costUsd != null ? { supplierBasePriceUsd: costUsd } : {}),
    },
  };
}

function pickCatalogButtonProps(onPick: () => void) {
  return {
    type: "button" as const,
    onMouseDown: (e: MouseEvent) => e.preventDefault(),
    onClick: onPick,
  };
}

function isLineLinked(line: WorkbookImportLineDraft): boolean {
  return Boolean(line.chemicalTypeId?.trim());
}

const EMPTY_WORKBOOK_EXPECTED: WorkbookImportLineDraft["expected"] = {
  totalCustomsFeeEtb: 0,
  totalLandedCostEtb: 0,
  unitCostEtbPerKg: 0,
  sellingPriceEtbPerKg: 0,
  targetMarginPct: 0,
};

export function WorkbookImportReviewModal({
  fileName,
  scenarios,
  metadata,
  initial,
  onConfirm,
  onCancel,
}: WorkbookImportReviewModalProps) {
  const { chemicals, loading: catalogLoading, refreshCatalog } =
    useProductCatalog();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [draft, setDraft] = useState<WorkbookImportDraft>(initial);
  const [lineDrafts, setLineDrafts] = useState<WorkbookImportLineDraft[]>([]);
  const [activeTab, setActiveTab] = useState<ReviewTab>("request");
  const [error, setError] = useState<string | null>(null);
  const [pmsSearch, setPmsSearch] = useState("");
  const [syncSharedRates, setSyncSharedRates] = useState(true);
  const [autoLinkOthers, setAutoLinkOthers] = useState(true);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    setLineDrafts(
      scenarios.map((scenario) => ({
        id: scenario.id,
        workbookName: scenario.name,
        productName: scenario.name,
        chemicalTypeId: null,
        quantityKg: scenario.inputs.quantityKg,
        inputs: { ...scenario.inputs },
        expected: { ...scenario.expected },
      })),
    );
    setActiveTab("request");
  }, [scenarios]);

  useEffect(() => {
    if (catalogLoading || chemicals.length === 0) return;
    setLineDrafts((prev) =>
      prev.map((line) => {
        if (line.chemicalTypeId) return line;
        const match = bestCatalogMatch(line.workbookName, chemicals);
        if (!match) return line;
        return { ...line, ...linePatchFromChemical(line, match) };
      }),
    );
  }, [catalogLoading, chemicals]);

  useEffect(() => {
    let cancelled = false;
    void fetchCustomers({ limit: 1000 })
      .then((res) => {
        if (!cancelled) setCustomers(sortCustomers(res.customers ?? []));
      })
      .catch(() => {
        if (!cancelled) setCustomers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const missingFromCsv = useMemo(
    () => ({
      clientName: !metadata.clientName.trim(),
      contactPerson: !metadata.contactPerson.trim(),
      requestDate: !metadata.requestDate.trim(),
      requestRef: !metadata.requestRef.trim(),
    }),
    [metadata],
  );

  const activeLine = lineDrafts.find((line) => line.id === activeTab);
  const linkedCount = lineDrafts.filter((line) => isLineLinked(line)).length;
  const unlinkedCount = lineDrafts.length - linkedCount;

  const preparedDraft = useMemo(
    () => ({
      ...draft,
      ...ensurePipelineRequestIds({
        requestDate: draft.requestDate,
        requestRef: draft.requestRef,
      }),
    }),
    [draft],
  );

  const saveBlockers = useMemo(() => {
    const blockers: string[] = [];
    const validationError = validatePipelineRequestFields(preparedDraft);
    if (validationError) blockers.push(validationError);
    const unlinked = lineDrafts.filter((line) => !isLineLinked(line));
    if (unlinked.length > 0) {
      blockers.push(
        `Link PMS for: ${unlinked.map((line) => line.workbookName).join(", ")}`,
      );
    }
    return blockers;
  }, [lineDrafts, preparedDraft]);

  const canSave = saveBlockers.length === 0 && lineDrafts.length > 0;

  const suggestions = useMemo(() => {
    if (!activeLine) return [];
    const query = activeLine.workbookName || activeLine.productName;
    return suggestCatalogProducts(query, chemicals, 6);
  }, [activeLine, chemicals]);

  const filteredCatalog = useMemo(() => {
    const q = pmsSearch.trim().toLowerCase();
    if (!q) return chemicals.slice(0, 30);
    return chemicals
      .filter((c) => {
        const name = (c.product_name ?? "").toLowerCase();
        const vendor = (c.vendor ?? "").toLowerCase();
        return name.includes(q) || vendor.includes(q);
      })
      .slice(0, 30);
  }, [chemicals, pmsSearch]);

  const linkedChemical = useMemo(() => {
    if (!activeLine?.chemicalTypeId) return null;
    return findCatalogProduct(activeLine.chemicalTypeId, chemicals) ?? null;
  }, [activeLine, chemicals]);


  function patchLineInputs(
    lineId: string,
    inputPatch: Partial<TradeTransitInputs>,
    syncAll: boolean,
  ) {
    setLineDrafts((prev) => {
      const source = prev.find((line) => line.id === lineId);
      if (!source) return prev;
      const nextInputs = { ...source.inputs, ...inputPatch };
      const shared = sharedRatesFromInputs(nextInputs);
      const sharedKeys = Object.keys(shared) as (keyof SharedTradeTransitRates)[];
      const touchesShared = sharedKeys.some((key) => key in inputPatch);
      if (syncAll && touchesShared) {
        return prev.map((line) => ({
          ...line,
          ...(line.id === lineId
            ? { inputs: nextInputs, quantityKg: inputPatch.quantityKg ?? line.quantityKg }
            : {}),
          inputs:
            line.id === lineId
              ? nextInputs
              : touchesShared
                ? { ...line.inputs, ...shared }
                : line.inputs,
        }));
      }
      return prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              inputs: nextInputs,
              quantityKg: inputPatch.quantityKg ?? line.quantityKg,
            }
          : line,
      );
    });
    setError(null);
  }

  function patchDraft(patch: Partial<WorkbookImportDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setError(null);
  }

  function patchLine(lineId: string, patch: Partial<WorkbookImportLineDraft>) {
    setLineDrafts((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    );
    setError(null);
  }

  function handleCustomerPick(customerId: string) {
    if (!customerId) {
      patchDraft({ customerId: "" });
      return;
    }
    const customer = customers.find((c) => c.customer_id === customerId);
    const ids = ensurePipelineRequestIds({
      requestDate: draft.requestDate,
      requestRef: draft.requestRef,
    });
    patchDraft({
      customerId,
      clientName: customer?.customer_name?.trim() || draft.clientName,
      contactPerson:
        customer?.primary_contact_name?.trim() || draft.contactPerson,
      ...ids,
    });
  }

  function addProductLine() {
    const template = lineDrafts[0];
    const shared = template
      ? sharedRatesFromInputs(template.inputs)
      : sharedRatesFromInputs({
          ...DEFAULT_TRADE_TRANSIT_INPUTS,
          ...customsRatesFromConstants(DEFAULT_FINANCE_CONSTANTS),
        });
    const nextIndex = lineDrafts.length + 1;
    const id = createTradeTransitLineId();
    setLineDrafts((prev) => [
      ...prev,
      {
        id,
        workbookName: `New product ${nextIndex}`,
        productName: "",
        chemicalTypeId: null,
        quantityKg: DEFAULT_TRADE_TRANSIT_INPUTS.quantityKg,
        inputs: {
          ...DEFAULT_TRADE_TRANSIT_INPUTS,
          ...customsRatesFromConstants(DEFAULT_FINANCE_CONSTANTS),
          ...shared,
        },
        expected: { ...EMPTY_WORKBOOK_EXPECTED },
      },
    ]);
    setActiveTab(id);
    setError(null);
  }

  function autoLinkAllFromCatalog() {
    setLineDrafts((prev) =>
      prev.map((line) => {
        if (line.chemicalTypeId) return line;
        const match = bestCatalogMatch(line.workbookName, chemicals);
        if (!match) return line;
        return { ...line, ...linePatchFromChemical(line, match) };
      }),
    );
    setError(null);
  }

  function handlePmsSelect(lineId: string, chemical: ChemicalFullData) {
    setLineDrafts((prev) => {
      let next = prev.map((line) =>
        line.id === lineId
          ? { ...line, ...linePatchFromChemical(line, chemical) }
          : line,
      );
      if (autoLinkOthers) {
        next = next.map((line) => {
          if (line.chemicalTypeId) return line;
          const match = bestCatalogMatch(line.workbookName, chemicals);
          if (!match) return line;
          return { ...line, ...linePatchFromChemical(line, match) };
        });
      }
      return next;
    });
    setPmsSearch("");
    setError(null);
  }

  function handleSave() {
    if (!canSave) {
      setError(saveBlockers[0] ?? "Complete the request and link every product.");
      if (validatePipelineRequestFields(preparedDraft)) {
        setActiveTab("request");
      } else {
        const firstUnlinked = lineDrafts.find((line) => !isLineLinked(line));
        if (firstUnlinked) setActiveTab(firstUnlinked.id);
      }
      return;
    }
    setDraft(preparedDraft);
    onConfirm({ draft: preparedDraft, lines: lineDrafts });
  }

  const modal = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close workbook import review"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 flex w-full max-w-5xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-950 shadow-2xl shadow-emerald-900/20">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              Workbook import review
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              {fileName}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Review pulled customer and product lines, link each SKU to PMS, then
              save to the pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          {(missingFromCsv.clientName ||
            missingFromCsv.contactPerson ||
            missingFromCsv.requestDate ||
            missingFromCsv.requestRef) && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Some pipeline fields were not found in the workbook. Fill them in
                on the Request tab before saving.
              </span>
            </p>
          )}

          {unlinkedCount > 0 && activeTab !== "request" && (
            <p className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
              {unlinkedCount} product line{unlinkedCount === 1 ? "" : "s"} still
              need a PMS catalog match.
            </p>
          )}

          {activeLine && isLineLinked(activeLine) && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              <strong>{activeLine.workbookName}</strong> is linked to PMS.
              {canSave
                ? " All products are ready — click Save to pipeline below."
                : unlinkedCount > 0
                  ? ` ${unlinkedCount} other line${unlinkedCount === 1 ? "" : "s"} still need a PMS link, or complete the Request tab.`
                  : " Complete the Request tab (contact person, pipeline #), then save."}
            </p>
          )}

          {activeTab === "request" ? (
            <section className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <UserRound className="h-4 w-4 text-emerald-400" />
                Customer request
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    CRM customer
                  </label>
                  <select
                    value={draft.customerId}
                    onChange={(e) => handleCustomerPick(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Select —</option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.customer_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Customer name *
                  </label>
                  <input
                    type="text"
                    value={draft.clientName}
                    onChange={(e) => patchDraft({ clientName: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Contact person *
                  </label>
                  <input
                    type="text"
                    value={draft.contactPerson}
                    onChange={(e) => patchDraft({ contactPerson: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Request date *
                  </label>
                  <input
                    type="date"
                    value={draft.requestDate}
                    onChange={(e) => patchDraft({ requestDate: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Pipeline / request number *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={draft.requestRef}
                      onChange={(e) => patchDraft({ requestRef: e.target.value })}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        patchDraft({
                          requestRef: generatePipelineRequestRef(draft.requestDate, "PROC"),
                        })
                      }
                      className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : activeLine ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Package className="h-4 w-4 text-cyan-400" />
                  Product line
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    isLineLinked(activeLine)
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-200 border border-amber-500/30"
                  }`}
                >
                  <Link2 className="h-3 w-3" />
                  {isLineLinked(activeLine) ? "PMS linked" : "Needs PMS link"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Name from workbook
                  </label>
                  <input
                    type="text"
                    value={activeLine.workbookName}
                    onChange={(e) =>
                      patchLine(activeLine.id, { workbookName: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Pipeline product label
                  </label>
                  <input
                    type="text"
                    value={activeLine.productName}
                    onChange={(e) =>
                      patchLine(activeLine.id, { productName: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Quantity (kg)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={activeLine.quantityKg}
                    onChange={(e) => {
                      const quantityKg = Number(e.target.value) || 0;
                      patchLineInputs(activeLine.id, { quantityKg }, false);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Supplier base (USD/kg)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={activeLine.inputs.supplierBasePriceUsd}
                    onChange={(e) =>
                      patchLineInputs(
                        activeLine.id,
                        {
                          supplierBasePriceUsd: Number(e.target.value) || 0,
                        },
                        false,
                      )
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Customs reference (USD/kg)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={activeLine.inputs.baseCustomsReferenceUsd}
                    onChange={(e) =>
                      patchLineInputs(
                        activeLine.id,
                        {
                          baseCustomsReferenceUsd: Number(e.target.value) || 0,
                        },
                        false,
                      )
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Parallel rate (ETB/USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={activeLine.inputs.capitalParallelRate}
                    onChange={(e) =>
                      patchLineInputs(
                        activeLine.id,
                        {
                          capitalParallelRate: Number(e.target.value) || 0,
                        },
                        syncSharedRates,
                      )
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    PMS catalog product
                  </label>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  <strong className="text-slate-400">Auto-link other lines</strong> — when
                  you pick a product here, the system also matches remaining workbook
                  rows to PMS by name.{" "}
                  <strong className="text-slate-400">Sync FX/tax rates</strong> — parallel
                  rate and duty % edits apply to every line on the same customer request.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoLinkOthers}
                      onChange={(e) => setAutoLinkOthers(e.target.checked)}
                      className="rounded border-white/20"
                    />
                    Auto-link other lines
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncSharedRates}
                      onChange={(e) => setSyncSharedRates(e.target.checked)}
                      className="rounded border-white/20"
                    />
                    Sync FX/tax rates to all lines
                  </label>
                </div>

                {linkedChemical ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                    <span>
                      Linked: <strong>{linkedChemical.product_name}</strong>
                      {linkedChemical.vendor ? ` · ${linkedChemical.vendor}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => patchLine(activeLine.id, { chemicalTypeId: null })}
                      className="text-xs text-emerald-300 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={autoLinkAllFromCatalog}
                  disabled={catalogLoading || chemicals.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Auto-link all lines from catalog
                </button>

                {suggestions.length > 0 && !isLineLinked(activeLine) ? (
                  <div>
                    <p className="mb-2 text-xs text-slate-500">
                      Best matches for “{activeLine.workbookName}”
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map(({ chemical, score }) => (
                        <button
                          key={`${catalogProductValue(chemical)}-${chemical.id}`}
                          {...pickCatalogButtonProps(() =>
                            handlePmsSelect(activeLine.id, chemical),
                          )}
                          className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-left text-xs text-cyan-100 hover:bg-cyan-500/20 transition"
                        >
                          <span className="font-semibold block">
                            {chemical.product_name}
                          </span>
                          <span className="text-cyan-300/70">
                            {chemical.vendor || "—"} · match {score}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="relative z-20">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={pmsSearch}
                    onChange={(e) => setPmsSearch(e.target.value)}
                    placeholder="Search PMS catalog by name or vendor…"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <div className="relative z-20 max-h-44 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5 bg-slate-950">
                  {filteredCatalog.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-slate-500 text-center">
                      No catalog matches. Try a shorter search.
                    </p>
                  ) : (
                    filteredCatalog.map((chemical, index) => {
                      const isSelected = linkedChemical?.id === chemical.id;
                      return (
                        <button
                          key={`${chemical.id}-${index}`}
                          {...pickCatalogButtonProps(() =>
                            handlePmsSelect(activeLine.id, chemical),
                          )}
                          className={`w-full px-3 py-2.5 text-left text-xs transition ${
                            isSelected
                              ? "bg-emerald-500/15 text-emerald-100"
                              : "text-slate-300 hover:bg-white/5"
                          }`}
                        >
                          <span className="font-semibold block">
                            {chemicalSearchPrimaryLabel(chemical)}
                          </span>
                          <span className="text-slate-500">
                            {chemical.vendor || "—"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-xs">
                <div>
                  <p className="text-slate-500">Workbook unit cost</p>
                  <p className="mt-1 font-semibold text-slate-200 tabular-nums">
                    {formatNumber(activeLine.expected.unitCostEtbPerKg, 2)} ETB/kg
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Workbook landed</p>
                  <p className="mt-1 font-semibold text-slate-200 tabular-nums">
                    {formatNumber(activeLine.expected.totalLandedCostEtb, 0)} ETB
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Customs (workbook)</p>
                  <p className="mt-1 font-semibold text-slate-200 tabular-nums">
                    {formatNumber(activeLine.expected.totalCustomsFeeEtb, 0)} ETB
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Sell ref (workbook)</p>
                  <p className="mt-1 font-semibold text-slate-200 tabular-nums">
                    {formatNumber(activeLine.expected.sellingPriceEtbPerKg, 2)} ETB/kg
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>

        <footer className="border-t border-white/10 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveTab("request")}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold border transition ${
                activeTab === "request"
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-100"
                  : "border-white/10 bg-slate-950 text-slate-400 hover:text-white"
              }`}
            >
              Request
            </button>
            {lineDrafts.map((line) => (
              <button
                key={line.id}
                type="button"
                onClick={() => setActiveTab(line.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold border transition max-w-[180px] truncate ${
                  activeTab === line.id
                    ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-100"
                    : isLineLinked(line)
                      ? "border-white/10 bg-slate-950 text-slate-300 hover:text-white"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                }`}
              >
                {line.workbookName}
              </button>
            ))}
            <button
              type="button"
              onClick={addProductLine}
              className="shrink-0 inline-flex items-center justify-center rounded-lg border border-dashed border-cyan-500/40 bg-cyan-500/5 px-3 py-2 text-cyan-200 hover:bg-cyan-500/15 transition min-w-[40px]"
              title="Add another product line"
              aria-label="Add line"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-slate-500">
              {linkedCount}/{lineDrafts.length} linked
              {canSave ? (
                <span className="text-emerald-400"> · ready to save</span>
              ) : saveBlockers[0] ? (
                <span className="text-amber-300"> · {saveBlockers[0]}</span>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={lineDrafts.length === 0}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                canSave
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-emerald-600/50 hover:bg-emerald-600/70"
              } disabled:opacity-50`}
            >
              <Check className="h-4 w-4" />
              Save to pipeline
            </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
