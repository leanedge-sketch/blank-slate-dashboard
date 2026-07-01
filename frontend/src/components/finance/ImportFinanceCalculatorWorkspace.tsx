import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Database,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";
import { useTradeTransitRequestOptional } from "../../contexts/TradeTransitRequestContext";
import { useImportFinanceData } from "../../hooks/useImportFinanceData";
import { RequestProductLineTabs } from "./RequestProductLineTabs";
import { PmsVendorProductPicker } from "../pms/PmsVendorProductPicker";
import type { ChemicalFullData } from "../../services/api";
import {
  resolveImportFinanceProductId,
  type ImportFinanceProduct,
  type ImportShipmentRow,
} from "../../services/importFinance";
import { catalogProductValue } from "../../utils/catalogProducts";
import { chemicalSearchPrimaryLabel } from "../../utils/chemicalMasterColumns";
import { DEFAULT_TRADE_PARAMETERS, validatePipelineRequestFields } from "../../types/tradeParameters";
import { formatNumber } from "../../utils/importFinanceCalc";
import { EXPECTED_COST_2026_SCENARIOS } from "../../data/expectedCost2026Scenarios";
import { parseWorkbookImport, type ExpectedCostScenario } from "../../utils/expectedCostCsv";
import { consumeStashedWorkbookUpload } from "../../utils/workbookUploadSession";
import { applyWorkbookExpectedAnchors } from "../../utils/workbookImportAlign";
import {
  calculateTradeTransit,
  customsRatesFromConstants,
  legacyShipmentToTradeTransit,
  importFinanceResultFromTradeTransit,
  tradeTransitToLegacyInputs,
  type TradeTransitInputs,
} from "../../utils/tradeTransitCalc";
import {
  applySharedRatesToLine,
  createTradeTransitLine,
  createBlankTradeTransitLine,
  createTradeTransitRequest,
  scenariosToTradeTransitRequest,
  sharedRatesFromInputs,
  syncSharedRatesAcrossRequest,
  summarizeTradeTransitRequest,
  type TradeTransitRequest,
} from "../../utils/tradeTransitRequest";
import {
  DEFAULT_TRADE_TRANSIT_INPUTS,
  ImportFinanceCalculatorPanel,
} from "./ImportFinanceCalculatorPanel";
import { PipelineSnapshotsTable } from "./trade-transit-hub/PipelineSnapshotsTable";
import { SavedPipelinesTransitSummary } from "./trade-transit-hub/SavedPipelinesTransitSummary";
import { TradeTransitRequestSummaryTable } from "./trade-transit-hub/TradeTransitRequestSummaryTable";
import { notifyPipelineSaved } from "../../lib/importFinanceEvents";
import {
  type ImportFinancePipelineDomain,
  PROCUREMENT_PIPELINE_DOMAIN,
  pipelineDomainLabel,
} from "../../lib/pipelineDomains";
import { TradeRequestContextBar } from "./trade-transit-hub/TradeRequestContextBar";
import {
  WorkbookImportReviewModal,
  type WorkbookImportConfirmPayload,
  type WorkbookImportDraft,
} from "./trade-transit-hub/WorkbookImportReviewModal";
import { TradeTransitPricingSelect } from "./TradeTransitPricingSelect";
import {
  loadPricingLocations,
  mapCustomerToCRMPartner,
} from "../pms/pricing-costing/pricingApi";
import { fetchCustomers } from "../../services/api";
import { syncTradeTransitLinesToPricing } from "../../services/tradeTransitPricingSync";
import {
  buildEditProductCostingPath,
  buildProductCostingLinePath,
  filterShipmentsForPipelineRequest,
  type PipelineRequestQuery,
} from "../../utils/pipelineEditPaths";

export type TradeTransitWorkspaceSection = "trade" | "products" | "summary" | "all";

type ImportFinanceCalculatorWorkspaceProps = {
  enabled?: boolean;
  showRecentShipments?: boolean;
  activeSection?: TradeTransitWorkspaceSection;
  historyOnly?: boolean;
  showProcurementLineAction?: boolean;
  showCustomerFields?: boolean;
  expandCalculatorInputs?: boolean;
  blankNewLines?: boolean;
  /** Load a saved pipeline request from snapshots (product costing edit mode). */
  editPipeline?: PipelineRequestQuery | null;
  /** After save on new-pipeline, navigate to product costing edit for this request. */
  navigateToProductCostingOnSave?: boolean;
  /** procurement (Trade & Transit) or sales (costing linked to a CRM deal). */
  pipelineDomain?: ImportFinancePipelineDomain;
  /** CRM sales_pipeline.id when pipelineDomain is sales. */
  salesPipelineId?: string | null;
};

const darkSelect =
  "w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50";

export function ImportFinanceCalculatorWorkspace({
  enabled = true,
  showRecentShipments = true,
  activeSection = "all",
  historyOnly = false,
  showProcurementLineAction = true,
  showCustomerFields = false,
  expandCalculatorInputs = false,
  blankNewLines = false,
  editPipeline = null,
  navigateToProductCostingOnSave = false,
  pipelineDomain = PROCUREMENT_PIPELINE_DOMAIN,
  salesPipelineId = null,
}: ImportFinanceCalculatorWorkspaceProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lineFromUrl = searchParams.get("line")?.trim() ?? "";
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
  } = useImportFinanceData(enabled, pipelineDomain);

  const transitCtx = useTradeTransitRequestOptional();
  const [localRequest, setLocalRequest] = useState<TradeTransitRequest>(() =>
    createTradeTransitRequest(""),
  );
  const request = transitCtx?.request ?? localRequest;
  const setRequest = transitCtx?.setRequest ?? setLocalRequest;
  const parameters = transitCtx?.parameters;
  const updateParameters = transitCtx?.updateParameters;

  const syncCustomerContext = useCallback(
    (patch: {
      customerId?: string;
      clientName?: string;
      contactPerson?: string;
      requestDate?: string;
      requestRef?: string;
    }) => {
      updateParameters?.(patch);
      setRequest((prev) => ({ ...prev, ...patch }));
    },
    [setRequest, updateParameters],
  );
  const [activeLineId, setActiveLineId] = useState<string>(
    () => request.lines[0]?.id ?? "",
  );
  const [loadedShipmentId, setLoadedShipmentId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [renamingLineId, setRenamingLineId] = useState<string | null>(null);
  const [pmsVendorFilter, setPmsVendorFilter] = useState("");
  const [pendingProductLinkLineId, setPendingProductLinkLineId] = useState<
    string | null
  >(null);
  const [calculatorFocusSignal, setCalculatorFocusSignal] = useState(0);
  const [csvScenarios, setCsvScenarios] = useState<ExpectedCostScenario[]>([]);
  const [pendingWorkbook, setPendingWorkbook] = useState<{
    fileName: string;
    scenarios: ExpectedCostScenario[];
    metadata: ReturnType<typeof parseWorkbookImport>["metadata"];
    initialDraft: WorkbookImportDraft;
  } | null>(null);
  const preWorkbookSnapshot = useRef<{
    request: TradeTransitRequest;
    csvScenarios: ExpectedCostScenario[];
  } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const loadedEditPipelineKey = useRef<string | null>(null);
  const stashConsumed = useRef(false);

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
    if (stashConsumed.current) return;
    const stashed = consumeStashedWorkbookUpload();
    if (!stashed) return;
    stashConsumed.current = true;

    const parsed = parseWorkbookImport(stashed.text);
    if (parsed.scenarios.length === 0) {
      alert(
        "Could not read product columns from this CSV. Use the Expected cost workbook format (product names in row 3).",
      );
      return;
    }

    preWorkbookSnapshot.current = {
      request: structuredClone(request),
      csvScenarios: [...csvScenarios],
    };
    setPendingWorkbook({
      fileName: stashed.fileName,
      scenarios: parsed.scenarios,
      metadata: parsed.metadata,
      initialDraft: buildWorkbookDraft(parsed.metadata, stashed.fileName),
    });
    // Consume hub / header upload once when this workspace mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeLine && request.lines[0]) {
      setActiveLineId(request.lines[0].id);
    }
  }, [activeLine, request.lines]);

  useEffect(() => {
    if (!lineFromUrl) return;
    if (!request.lines.some((line) => line.id === lineFromUrl)) return;
    setActiveLineId(lineFromUrl);
  }, [lineFromUrl, request.lines]);

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

  function renameLine(lineId: string, productName: string) {
    setLoadedShipmentId(null);
    setRequest((prev) => ({
      ...prev,
      lines: prev.lines.map((line) =>
        line.id === lineId ? { ...line, productName } : line,
      ),
    }));
  }

  function addProductLine() {
    const template = activeLine ?? request.lines[0];
    const shared = template
      ? sharedRatesFromInputs(template.inputs)
      : sharedRatesFromInputs(DEFAULT_TRADE_TRANSIT_INPUTS);
    const createLine = blankNewLines ? createBlankTradeTransitLine : createTradeTransitLine;
    const line = applySharedRatesToLine(
      createLine("", {
        ...customsRatesFromConstants(constants),
      }),
      shared,
    );
    setRequest((prev) => ({
      ...prev,
      lines: [...prev.lines, line],
    }));
    setActiveLineId(line.id);
    setRenamingLineId(null);
    setPendingProductLinkLineId(line.id);
    setSelectedScenarioId("");
    setLoadedShipmentId(null);
  }

  function removeActiveLine() {
    if (request.lines.length <= 1) return;
    removeLineById(activeLineId);
  }

  function removeLineById(lineId: string) {
    const nextLines = request.lines.filter((line) => line.id !== lineId);
    setRequest((prev) => ({ ...prev, lines: nextLines }));
    if (activeLineId === lineId) {
      setActiveLineId(nextLines[0]?.id ?? "");
    }
    setSelectedScenarioId("");
    setLoadedShipmentId(null);
    setImportNotice("Line removed from this session — saved snapshots are unchanged.");
  }

  function editLineById(lineId: string) {
    if (!request.lines.some((line) => line.id === lineId)) return;
    setActiveLineId(lineId);
    setRenamingLineId(null);
    setSelectedScenarioId("");
    if (activeSection === "summary") {
      navigate(buildProductCostingLinePath(lineId));
      return;
    }
    setCalculatorFocusSignal((n) => n + 1);
    document.getElementById("trade-transit-product-workspace")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handlePipelineDeleted(deletedIds: string[]) {
    const deletedSet = new Set(deletedIds);
    const deletedRows = shipments.filter((row) => deletedSet.has(row.id));
    const deletedRefs = new Set(
      deletedRows.map((row) => (row.request_ref ?? "").trim()).filter(Boolean),
    );
    const currentRef = request.requestRef.trim();

    const touchedCurrentRequest =
      (loadedShipmentId && deletedSet.has(loadedShipmentId)) ||
      (currentRef && deletedRefs.has(currentRef));

    if (touchedCurrentRequest) {
      setLoadedShipmentId(null);
      setSelectedScenarioId("");
      setImportNotice(
        "The saved procurement request was deleted and removed from Trade & Transit.",
      );
      if (editPipeline || historyOnly) {
        setRequest(createTradeTransitRequest(""));
        setActiveLineId("");
      }
    }

    void reload();
  }

  function handlePmsProductSelect(chemical: ChemicalFullData) {
    const catalogId = catalogProductValue(chemical);
    const productName = chemicalSearchPrimaryLabel(chemical);
    const matchedFinance = products.find(
      (p) =>
        p.product_name.trim().toLowerCase() === productName.trim().toLowerCase(),
    );
    const customsRef = matchedFinance?.base_customs_reference_usd;
    if (chemical.vendor?.trim()) {
      setPmsVendorFilter(chemical.vendor.trim());
    }
    setRenamingLineId(null);
    setPendingProductLinkLineId(null);
    setCalculatorFocusSignal((n) => n + 1);
    updateActiveLine({
      chemicalTypeId: catalogId,
      productName,
      productId: matchedFinance?.id ?? null,
      ...(Number.isFinite(customsRef) && customsRef! > 0
        ? { baseCustomsReferenceUsd: customsRef }
        : {}),
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
    meta?: Partial<Pick<TradeTransitRequest, "customerId" | "contactPerson" | "requestDate" | "requestRef">>,
  ) {
    const next = scenariosToTradeTransitRequest(scenarios, clientName);
    setRequest({
      ...next,
      customerId: meta?.customerId ?? next.customerId,
      contactPerson: meta?.contactPerson ?? next.contactPerson,
      requestDate: meta?.requestDate ?? next.requestDate,
      requestRef: meta?.requestRef ?? next.requestRef,
    });
    setActiveLineId(next.lines[0]?.id ?? "");
    setSelectedScenarioId("");
    setLoadedShipmentId(null);
  }

  function buildWorkbookDraft(
    metadata: ReturnType<typeof parseWorkbookImport>["metadata"],
    fileName: string,
  ): WorkbookImportDraft {
    const fileStem = fileName.replace(/\.csv$/i, "").trim();
    return {
      customerId: parameters?.customerId || request.customerId || "",
      clientName:
        metadata.clientName.trim() ||
        parameters?.clientName.trim() ||
        request.clientName.trim() ||
        fileStem ||
        "",
      contactPerson:
        metadata.contactPerson.trim() ||
        parameters?.contactPerson.trim() ||
        request.contactPerson.trim() ||
        "",
      requestDate:
        metadata.requestDate.trim() ||
        parameters?.requestDate.trim() ||
        request.requestDate.trim() ||
        new Date().toISOString().slice(0, 10),
      requestRef:
        metadata.requestRef.trim() ||
        parameters?.requestRef.trim() ||
        request.requestRef.trim() ||
        "",
    };
  }

  async function handleCsvUpload(file: File) {
    const text = await file.text();
    const parsed = parseWorkbookImport(text);
    if (parsed.scenarios.length === 0) {
      alert(
        "Could not read product columns from this CSV. Use the Expected cost workbook format (product names in row 3).",
      );
      return;
    }

    preWorkbookSnapshot.current = {
      request: structuredClone(request),
      csvScenarios: [...csvScenarios],
    };

    setPendingWorkbook({
      fileName: file.name,
      scenarios: parsed.scenarios,
      metadata: parsed.metadata,
      initialDraft: buildWorkbookDraft(parsed.metadata, file.name),
    });
  }

  async function handleConfirmWorkbookImport(payload: WorkbookImportConfirmPayload) {
    if (!pendingWorkbook) return;

    const { draft, lines } = payload;

    syncCustomerContext({
      customerId: draft.customerId,
      clientName: draft.clientName,
      contactPerson: draft.contactPerson,
      requestDate: draft.requestDate,
      requestRef: draft.requestRef,
    });

    const shared = sharedRatesFromInputs(lines[0]?.inputs ?? {});
    const tradeLines = lines.map((line) =>
      applySharedRatesToLine(
        createTradeTransitLine(line.productName, {
          ...applyWorkbookExpectedAnchors(line.inputs, line.expected),
          quantityKg: line.quantityKg,
          chemicalTypeId: line.chemicalTypeId,
          productId: null,
        }),
        shared,
      ),
    );

    let synced = syncSharedRatesAcrossRequest(
      {
        ...createTradeTransitRequest(
          draft.clientName,
          tradeLines,
          draft.customerId,
          draft.contactPerson,
          draft.requestDate,
        ),
        requestRef: draft.requestRef,
      },
      shared,
    );

    setRequest(synced);
    setActiveLineId(synced.lines[0]?.id ?? "");
    setSelectedScenarioId("");
    setLoadedShipmentId(null);
    setImportNotice(
      `Loaded ${synced.lines.length} product line${synced.lines.length === 1 ? "" : "s"} from workbook — Excel costs and sell prices preserved. Review any discrepancy warnings on saved lines.`,
    );

    setCsvScenarios(
      lines.map((line) => ({
        id: line.id,
        name: line.productName,
        inputs: line.inputs,
        expected: line.expected,
      })),
    );

    setPendingWorkbook(null);
    preWorkbookSnapshot.current = null;
  }

  function handleCancelWorkbookImport() {
    if (preWorkbookSnapshot.current) {
      setRequest(preWorkbookSnapshot.current.request);
      setCsvScenarios(preWorkbookSnapshot.current.csvScenarios);
    }
    setPendingWorkbook(null);
    preWorkbookSnapshot.current = null;
  }


  function shipmentToLine(row: ImportShipmentRow) {
    const product = products.find((p) => p.id === row.product_id);
    return createTradeTransitLine(product?.product_name ?? "Loaded product", {
      ...legacyShipmentToTradeTransit(row),
      productId: row.product_id,
      chemicalTypeId: row.chemical_type_id ?? null,
    });
  }

  function handleLoadShipment(row: ImportShipmentRow) {
    handleLoadShipmentGroup([row]);
  }

  function handleLoadShipmentGroup(rows: ImportShipmentRow[]) {
    if (rows.length === 0) return;
    const first = rows[0]!;
    const lines = rows.map((row) => shipmentToLine(row));
    const shared = sharedRatesFromInputs(lines[0]!.inputs);
    const synced = syncSharedRatesAcrossRequest(
      {
        ...createTradeTransitRequest(
          first.client_name?.trim() || "",
          lines.map((line) => applySharedRatesToLine(line, shared)),
          first.customer_id?.trim() || "",
          first.contact_person?.trim() || "",
          first.request_date?.trim() || "",
        ),
        requestRef: first.request_ref?.trim() || "",
      },
      shared,
    );
    setRequest(synced);
    syncCustomerContext({
      customerId: first.customer_id?.trim() || "",
      clientName: first.client_name?.trim() || "",
      contactPerson: first.contact_person?.trim() || "",
      requestDate: first.request_date?.trim() || "",
      requestRef: first.request_ref?.trim() || "",
    });
    setActiveLineId(synced.lines[0]?.id ?? "");
    setSelectedScenarioId("");
    setLoadedShipmentId(first.id);
    setImportNotice(
      lines.length > 1
        ? `Loaded ${lines.length} products for request ${first.request_ref?.trim() || "—"} — use the product tabs above.`
        : editPipeline
          ? `Editing saved pipeline ${first.request_ref?.trim() || "—"} — adjust lines and save again.`
          : null,
    );
  }

  useEffect(() => {
    if (!editPipeline || loading) return;
    const key = `${editPipeline.requestRef}::${editPipeline.clientName ?? ""}::${editPipeline.customerId ?? ""}`;
    if (loadedEditPipelineKey.current === key) return;

    const rows = filterShipmentsForPipelineRequest(shipments, editPipeline);
    if (rows.length === 0) return;

    loadedEditPipelineKey.current = key;
    handleLoadShipmentGroup(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per edit query key
  }, [editPipeline, loading, shipments]);

  async function handleSaveDraft() {
    const clientLabel =
      parameters?.clientName.trim() ||
      request.clientName.trim() ||
      "Unnamed client";
    const contactLabel =
      parameters?.contactPerson.trim() ||
      request.contactPerson.trim() ||
      "";
    const requestDateLabel =
      parameters?.requestDate.trim() ||
      request.requestDate.trim() ||
      "";
    const requestRefLabel =
      parameters?.requestRef.trim() ||
      request.requestRef.trim() ||
      "";

    const pipelineError = validatePipelineRequestFields({
      clientName: clientLabel === "Unnamed client" ? "" : clientLabel,
      contactPerson: contactLabel,
      requestDate: requestDateLabel,
      requestRef: requestRefLabel,
    });
    if (pipelineError) {
      alert(pipelineError);
      return;
    }

    if (pendingWorkbook) {
      alert("Apply or cancel the workbook import review before saving.");
      return;
    }
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

        const ttResult = calculateTradeTransit(line.inputs, constants);
        const legacyInputs = tradeTransitToLegacyInputs(line.inputs, ttResult);
        const financeResult = importFinanceResultFromTradeTransit(
          line.inputs,
          ttResult,
        );
        await saveDraft(productId, legacyInputs, constants, {
          clientName: clientLabel,
          contactPerson: contactLabel || undefined,
          requestDate: requestDateLabel || undefined,
          requestRef: requestRefLabel,
          chemicalTypeId: line.chemicalTypeId,
          customerId:
            parameters?.customerId?.trim() ||
            request.customerId?.trim() ||
            null,
          targetCurrency:
            parameters?.targetCurrency?.trim() ||
            DEFAULT_TRADE_PARAMETERS.targetCurrency,
          salesPipelineId: salesPipelineId?.trim() || null,
        }, financeResult);
      }
      alert(
        `Saved ${linkedLines.length} ${pipelineDomainLabel(pipelineDomain).toLowerCase()} line(s) for client "${clientLabel}".`,
      );

      await reload();
      notifyPipelineSaved({
        count: linkedLines.length,
        clientName: clientLabel,
        requestRef: requestRefLabel || undefined,
      });

      if (navigateToProductCostingOnSave && requestRefLabel) {
        navigate(
          buildEditProductCostingPath({
            requestRef: requestRefLabel,
            clientName: clientLabel,
            customerId:
              parameters?.customerId?.trim() ||
              request.customerId?.trim() ||
              undefined,
          }),
        );
      }

      try {
        const customersRes = await fetchCustomers({ limit: 500 });
        const partners = (customersRes.customers ?? []).map(mapCustomerToCRMPartner);
        const locations = await loadPricingLocations();
        const syncResult = await syncTradeTransitLinesToPricing({
          lines: linkedLines,
          clientName: clientLabel,
          parameters: parameters ?? {
            ...DEFAULT_TRADE_PARAMETERS,
            clientName: clientLabel,
            contactPerson: contactLabel,
            requestDate: requestDateLabel,
            requestRef: requestRefLabel,
            exchangeRate: activeLine?.inputs.capitalParallelRate ?? DEFAULT_TRADE_PARAMETERS.exchangeRate,
          },
          partners,
          locations,
          constants,
        });
        if (syncResult.synced > 0) {
          alert(
            `Updated ${syncResult.synced} pricing row(s) in PMS Pricing & Costing.`,
          );
        } else if (syncResult.skipped.length > 0) {
          console.warn("Pricing sync skipped:", syncResult.skipped.join(" "));
        }
        if (syncResult.errors.length > 0) {
          console.warn("Pricing sync errors:", syncResult.errors.join("; "));
        }
      } catch (syncErr) {
        console.warn("Could not sync Trade & Transit to pricing:", syncErr);
      }
    } catch {
      /* error banner */
    }
  }

  const showProducts =
    activeSection === "all" || activeSection === "products";
  const showSummary =
    activeSection === "all" || activeSection === "summary";

  const procurementLauncherOnly =
    showProcurementLineAction && !showCustomerFields && !historyOnly;

  if (!activeLine && !showSummary && !procurementLauncherOnly) {
    return null;
  }

  const showWorkspace = showProducts && !procurementLauncherOnly;
  const showTooling = showWorkspace && !historyOnly;
  const showCalculator = showWorkspace && !historyOnly;
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

      {pendingWorkbook ? (
        <WorkbookImportReviewModal
          fileName={pendingWorkbook.fileName}
          scenarios={pendingWorkbook.scenarios}
          metadata={pendingWorkbook.metadata}
          initial={pendingWorkbook.initialDraft}
          onConfirm={handleConfirmWorkbookImport}
          onCancel={handleCancelWorkbookImport}
        />
      ) : null}

      {showProducts && (
        <TradeRequestContextBar
          parameters={parameters}
          request={request}
          productCount={request.lines.length}
          readOnly={historyOnly}
          showProcurementLineAction={showProcurementLineAction}
          showCustomerFields={showCustomerFields}
          onSync={syncCustomerContext}
        />
      )}

      {importNotice && showWorkspace && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-100">
          {importNotice}
        </p>
      )}

      {showWorkspace && (
        <RequestProductLineTabs
          request={request}
          summary={summary}
          activeLineId={activeLineId}
          renamingLineId={renamingLineId}
          onSelectLine={(lineId) => {
            setActiveLineId(lineId);
            setSelectedScenarioId("");
            setRenamingLineId(null);
          }}
          onAddLine={addProductLine}
          onRemoveActive={removeActiveLine}
          onRenameLine={renameLine}
          onRenamingLineIdChange={setRenamingLineId}
          showRequestHeader={historyOnly}
        />
      )}

      {showSummary && (
        <TradeTransitRequestSummaryTable
          clientName={request.clientName}
          contactPerson={request.contactPerson}
          requestRef={request.requestRef}
          summary={summary}
          fullPanel={activeSection === "summary"}
          onEditLine={editLineById}
          onRemoveLine={removeLineById}
        />
      )}

      {activeSection === "summary" && (
        <TradeRequestContextBar
          parameters={parameters}
          request={request}
          productCount={request.lines.length}
          readOnly
          showProcurementLineAction={false}
          showCustomerFields
          onSync={() => {}}
        />
      )}

      {activeSection === "summary" && (
        <SavedPipelinesTransitSummary
          shipments={shipments}
          products={products}
          constants={constants}
          onReload={reload}
          pipelineDomain={pipelineDomain}
          showSearch
          searchCompany={parameters?.clientName ?? request.clientName}
          searchContact={parameters?.contactPerson ?? request.contactPerson}
        />
      )}

      {showTooling && activeLine && (
      <div id="trade-transit-product-workspace" className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 overflow-visible">
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
        <div className="min-w-[280px] flex-[2] overflow-visible">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
            <Database className="h-3.5 w-3.5 text-cyan-500" />
            PMS product (active line)
          </label>
          <PmsVendorProductPicker
            value={activeLine.chemicalTypeId}
            vendorFilter={pmsVendorFilter}
            onVendorFilterChange={setPmsVendorFilter}
            autoFocusSearch={pendingProductLinkLineId === activeLine.id}
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
            disabled={saving || Boolean(setupHint) || Boolean(pendingWorkbook)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] disabled:opacity-50 transition"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save all product lines
          </button>
        </div>
      </div>
      )}

      {showTooling && activeLine && (
        <TradeTransitPricingSelect
          clientName={
            parameters?.clientName.trim() ||
            request.clientName.trim() ||
            ""
          }
          chemicalTypeId={activeLine.chemicalTypeId}
          parameters={
            parameters ?? {
              ...DEFAULT_TRADE_PARAMETERS,
              customerId: request.customerId,
              clientName: request.clientName,
              contactPerson: request.contactPerson,
              requestDate: request.requestDate,
              requestRef: request.requestRef,
              exchangeRate: activeLine.inputs.capitalParallelRate,
            }
          }
          disabled={loading || saving}
          onApply={(patch) => {
            updateActiveLine(patch);
          }}
        />
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

      {showCalculator && loadedShipmentId && request.lines.length > 1 && (
        <p className="text-xs text-cyan-400/90">
          Loaded {request.lines.length} products from request snapshot — switch
          tabs above or save all linked lines.
        </p>
      )}

      {showCalculator && activeLine && (
      <ImportFinanceCalculatorPanel
        key={activeLine.id}
        inputs={activeLine.inputs}
        onChange={updateActiveLine}
        constants={constants as FinanceConstants}
        expandAllInputs={expandCalculatorInputs}
        focusStageSignal={calculatorFocusSignal}
      />
      )}

      {showShipments && (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Saved procurement requests
            <span className="ml-2 text-xs font-normal text-slate-500">
              click request ID to load all products, or a row for one line
            </span>
          </h3>
          <PipelineSnapshotsTable
            shipments={shipments}
            products={products}
            loadedShipmentId={loadedShipmentId}
            onLoadGroup={handleLoadShipmentGroup}
            onLoadRow={handleLoadShipment}
            onPipelineDeleted={handlePipelineDeleted}
          />
        </div>
      )}
    </div>
  );
}
