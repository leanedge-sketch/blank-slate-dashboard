import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EXPECTED_COST_2026_SCENARIOS } from "../data/expectedCost2026Scenarios";
import {
  DEFAULT_TRADE_PARAMETERS,
  createDefaultValidityDate,
  normalizeTradeParameters,
  type TradeParameters,
} from "../types/tradeParameters";
import {
  createBlankTradeTransitLine,
  createTradeTransitLine,
  createTradeTransitRequest,
  scenariosToTradeTransitRequest,
  syncSharedRatesAcrossRequest,
  sharedRatesFromInputs,
  type TradeTransitRequest,
} from "../utils/tradeTransitRequest";
import { customsRatesFromConstants } from "../utils/tradeTransitCalc";
import { DEFAULT_FINANCE_CONSTANTS } from "../utils/importFinanceCalc";
import {
  clearTradeTransitAutosave,
  loadTradeTransitAutosave,
  saveTradeTransitAutosave,
} from "../utils/tradeTransitAutosave";

export const TRADE_TRANSIT_ROUTES = {
  hub: "/finance/import",
  newPipeline: "/finance/new-pipeline",
  tradeParameters: "/finance/trade-parameters",
  productCosting: "/finance/product-costing",
  transitSummary: "/finance/transit-summary",
  executiveReport: "/reports/executive",
} as const;

interface TradeTransitRequestContextValue {
  parameters: TradeParameters;
  updateParameters: (patch: Partial<TradeParameters>) => void;
  setParameters: (next: TradeParameters) => void;
  request: TradeTransitRequest;
  setRequest: React.Dispatch<React.SetStateAction<TradeTransitRequest>>;
  applyParametersToRequest: () => void;
  loadExpectedCost2026Sample: () => void;
  beginNewPipelineSession: (opts?: { clearAutosave?: boolean }) => void;
  autosaveSavedAt: string | null;
  autosaveRestored: boolean;
  restoreAutosaveDraft: () => void;
  clearAutosave: () => void;
  /** Wipe draft storage + in-memory wizard state (Discard button). */
  discardAutosaveDraft: () => void;
  setAutosaveEnabled: (enabled: boolean) => void;
}

const TradeTransitRequestContext =
  createContext<TradeTransitRequestContextValue | null>(null);

export function TradeTransitRequestProvider({ children }: { children: ReactNode }) {
  const initialDraft = loadTradeTransitAutosave();
  const [parameters, setParametersState] = useState<TradeParameters>(() => {
    return normalizeTradeParameters({
      validityDate: "",
    });
  });
  const [request, setRequest] = useState<TradeTransitRequest>(() => {
    return createTradeTransitRequest("");
  });
  const [autosaveSavedAt, setAutosaveSavedAt] = useState<string | null>(
    initialDraft?.savedAt ?? null,
  );
  const [autosaveRestored, setAutosaveRestored] = useState<boolean>(false);
  const [autosaveEnabled, setAutosaveEnabledState] = useState<boolean>(true);

  const setParameters = useCallback((next: TradeParameters) => {
    setParametersState(next);
  }, []);

  const updateParameters = useCallback((patch: Partial<TradeParameters>) => {
    setParametersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyParametersToRequest = useCallback(() => {
    setRequest((prev) => {
      const rate =
        parameters.exchangeRate > 0
          ? parameters.exchangeRate
          : DEFAULT_TRADE_PARAMETERS.exchangeRate;

      const withMeta: TradeTransitRequest = {
        ...prev,
        customerId: parameters.customerId,
        clientName: parameters.clientName,
        contactPerson: parameters.contactPerson,
        requestDate: parameters.requestDate,
        requestRef: parameters.requestRef,
        lines: prev.lines.map((line) => ({
          ...line,
          inputs: {
            ...line.inputs,
            capitalParallelRate: rate,
            ...customsRatesFromConstants(DEFAULT_FINANCE_CONSTANTS),
          },
        })),
      };

      const shared = sharedRatesFromInputs(withMeta.lines[0]?.inputs ?? {});
      return syncSharedRatesAcrossRequest(withMeta, shared);
    });
  }, [parameters]);

  const loadExpectedCost2026Sample = useCallback(() => {
    const clientName =
      parameters.clientName.trim() || "2026 Expected cost";
    const next = scenariosToTradeTransitRequest(
      EXPECTED_COST_2026_SCENARIOS,
      clientName,
    );
    setParametersState((prev) => ({
      ...prev,
      clientName,
      requestRef: next.requestRef || prev.requestRef,
    }));
    setRequest(next);
  }, [parameters.clientName]);

  const beginNewPipelineSession = useCallback(
    (opts?: { clearAutosave?: boolean }) => {
      const exchangeRate = DEFAULT_TRADE_PARAMETERS.exchangeRate;
      const clear = opts?.clearAutosave !== false;
      if (clear) {
        clearTradeTransitAutosave();
        setAutosaveSavedAt(null);
      }
      setAutosaveRestored(false);

      setParametersState(
        normalizeTradeParameters({
          customerId: "",
          clientName: "",
          contactPerson: "",
          requestDate: "",
          requestRef: "",
          validityDate: createDefaultValidityDate(),
          exchangeRate,
        }),
      );

      const line = createBlankTradeTransitLine("", {
        ...customsRatesFromConstants(DEFAULT_FINANCE_CONSTANTS),
        capitalParallelRate: exchangeRate,
      });

      setRequest(createTradeTransitRequest("", [line]));
    },
    [],
  );

  const clearAutosave = useCallback(() => {
    clearTradeTransitAutosave();
    setAutosaveSavedAt(null);
    // Mark handled so the Resume/Discard prompt does not reopen.
    setAutosaveRestored(true);
  }, []);

  const discardAutosaveDraft = useCallback(() => {
    clearTradeTransitAutosave();
    setAutosaveSavedAt(null);
    setAutosaveRestored(true);

    const exchangeRate = DEFAULT_TRADE_PARAMETERS.exchangeRate;
    setParametersState(
      normalizeTradeParameters({
        customerId: "",
        clientName: "",
        contactPerson: "",
        requestDate: "",
        requestRef: "",
        validityDate: createDefaultValidityDate(),
        exchangeRate,
      }),
    );
    const line = createBlankTradeTransitLine("", {
      ...customsRatesFromConstants(DEFAULT_FINANCE_CONSTANTS),
      capitalParallelRate: exchangeRate,
    });
    setRequest(createTradeTransitRequest("", [line]));
  }, []);

  useEffect(() => {
    if (!autosaveEnabled) return;

    const timer = window.setTimeout(() => {
      const hasMeaningfulDraft =
        Boolean(parameters.clientName?.trim()) ||
        Boolean(parameters.requestRef?.trim()) ||
        Boolean(parameters.contactPerson?.trim()) ||
        request.lines.some(
          (line) =>
            Boolean(line.productName?.trim()) ||
            Number(line.inputs?.supplierBasePriceUsd || 0) > 0,
        );

      // After Discard we reset to a blank session — do not immediately rewrite
      // localStorage or the "unsaved draft" prompt will return.
      if (!hasMeaningfulDraft) {
        clearTradeTransitAutosave();
        setAutosaveSavedAt(null);
        return;
      }

      const saved = saveTradeTransitAutosave({
        tradeParameters: parameters,
        productLines: request.lines,
        calculatorInputs: request.lines.map((l) => l.inputs),
        request,
      });
      if (saved?.savedAt) setAutosaveSavedAt(saved.savedAt);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [autosaveEnabled, parameters, request]);

  const restoreAutosaveDraft = useCallback(() => {
    const draft = loadTradeTransitAutosave();
    if (!draft) return;
    setParametersState(normalizeTradeParameters(draft.tradeParameters));
    setRequest(draft.request);
    setAutosaveSavedAt(draft.savedAt);
    setAutosaveRestored(true);
  }, []);

  const value = useMemo(
    () => ({
      parameters,
      updateParameters,
      setParameters,
      request,
      setRequest,
      applyParametersToRequest,
      loadExpectedCost2026Sample,
      beginNewPipelineSession,
      autosaveSavedAt,
      autosaveRestored,
      restoreAutosaveDraft,
      clearAutosave,
      discardAutosaveDraft,
      setAutosaveEnabled: setAutosaveEnabledState,
    }),
    [
      parameters,
      updateParameters,
      setParameters,
      request,
      applyParametersToRequest,
      loadExpectedCost2026Sample,
      beginNewPipelineSession,
      autosaveSavedAt,
      autosaveRestored,
      restoreAutosaveDraft,
      clearAutosave,
      discardAutosaveDraft,
      setAutosaveEnabledState,
    ],
  );

  return (
    <TradeTransitRequestContext.Provider value={value}>
      {children}
    </TradeTransitRequestContext.Provider>
  );
}

export function useTradeTransitRequest(): TradeTransitRequestContextValue {
  const ctx = useContext(TradeTransitRequestContext);
  if (!ctx) {
    throw new Error(
      "useTradeTransitRequest must be used within TradeTransitRequestProvider",
    );
  }
  return ctx;
}

/** Optional hook for dock / legacy embeds outside the provider. */
export function useTradeTransitRequestOptional():
  | TradeTransitRequestContextValue
  | null {
  return useContext(TradeTransitRequestContext);
}
