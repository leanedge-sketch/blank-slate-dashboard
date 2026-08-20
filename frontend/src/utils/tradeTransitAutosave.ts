import type { TradeParameters } from "../types/tradeParameters";
import type { TradeTransitRequest } from "./tradeTransitRequest";

// Phase 1 key (explicit + deterministic): used for the multi-step procurement wizard draft.
const STORAGE_KEY = "leanchem_transit_wizard_draft";

export type TradeTransitAutosavePayload = {
  version: 1;
  savedAt: string;
  tradeParameters: TradeParameters;
  // Store product lines separately for easy introspection/debugging.
  productLines: TradeTransitRequest["lines"];
  // Calculator inputs are line inputs; included explicitly to match Phase 1 requirements.
  calculatorInputs: TradeTransitRequest["lines"][number]["inputs"][];
  request: TradeTransitRequest;
};

export function loadTradeTransitAutosave(): TradeTransitAutosavePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TradeTransitAutosavePayload> | null;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.savedAt ||
      !parsed.tradeParameters ||
      !parsed.productLines ||
      !parsed.request ||
      !parsed.calculatorInputs
    ) {
      return null;
    }
    return parsed as TradeTransitAutosavePayload;
  } catch {
    return null;
  }
}

export function saveTradeTransitAutosave(
  payload: Omit<TradeTransitAutosavePayload, "version" | "savedAt">,
): TradeTransitAutosavePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const wrapped: TradeTransitAutosavePayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...payload,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapped));
    return wrapped;
  } catch {
    return null;
  }
}

export function clearTradeTransitAutosave(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures; autosave is best-effort only.
  }
}
