import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EXPECTED_COST_2026_SCENARIOS } from "../data/expectedCost2026Scenarios";
import {
  DEFAULT_TRADE_PARAMETERS,
  normalizeTradeParameters,
  type TradeParameters,
} from "../types/tradeParameters";
import {
  createTradeTransitRequest,
  scenariosToTradeTransitRequest,
  syncSharedRatesAcrossRequest,
  sharedRatesFromInputs,
  type TradeTransitRequest,
} from "../utils/tradeTransitRequest";
import { customsRatesFromConstants } from "../utils/tradeTransitCalc";
import { DEFAULT_FINANCE_CONSTANTS } from "../utils/importFinanceCalc";

export const TRADE_TRANSIT_ROUTES = {
  hub: "/finance/import",
  tradeParameters: "/finance/trade-parameters",
  productCosting: "/finance/product-costing",
  transitSummary: "/finance/transit-summary",
} as const;

interface TradeTransitRequestContextValue {
  parameters: TradeParameters;
  updateParameters: (patch: Partial<TradeParameters>) => void;
  setParameters: (next: TradeParameters) => void;
  request: TradeTransitRequest;
  setRequest: React.Dispatch<React.SetStateAction<TradeTransitRequest>>;
  applyParametersToRequest: () => void;
  loadExpectedCost2026Sample: () => void;
}

const TradeTransitRequestContext =
  createContext<TradeTransitRequestContextValue | null>(null);

export function TradeTransitRequestProvider({ children }: { children: ReactNode }) {
  const [parameters, setParametersState] = useState<TradeParameters>(() =>
    normalizeTradeParameters({
      validityDate: "",
    }),
  );
  const [request, setRequest] = useState<TradeTransitRequest>(() =>
    createTradeTransitRequest(""),
  );

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

  const value = useMemo(
    () => ({
      parameters,
      updateParameters,
      setParameters,
      request,
      setRequest,
      applyParametersToRequest,
      loadExpectedCost2026Sample,
    }),
    [
      parameters,
      updateParameters,
      setParameters,
      request,
      applyParametersToRequest,
      loadExpectedCost2026Sample,
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
