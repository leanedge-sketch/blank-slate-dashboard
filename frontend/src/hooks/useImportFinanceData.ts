import { useCallback, useEffect, useState } from "react";
import {
  fetchImportFinanceConstants,
  fetchImportFinanceProducts,
  fetchRecentImportShipments,
  importFinanceSetupHint,
  saveImportShipmentDraft,
  type ImportFinanceProduct,
  type ImportShipmentRow,
} from "../services/importFinance";
import {
  DEFAULT_FINANCE_CONSTANTS,
  type FinanceConstants,
  type ImportFinanceInputs,
} from "../utils/importFinanceCalc";

export function useImportFinanceData(enabled = true) {
  const [constants, setConstants] = useState<FinanceConstants>(
    DEFAULT_FINANCE_CONSTANTS,
  );
  const [products, setProducts] = useState<ImportFinanceProduct[]>([]);
  const [shipments, setShipments] = useState<ImportShipmentRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    setSetupHint(null);
    try {
      const [constantsRes, productsRes, shipmentsRes] = await Promise.all([
        fetchImportFinanceConstants(),
        fetchImportFinanceProducts(),
        fetchRecentImportShipments(),
      ]);
      setConstants(constantsRes);
      setProducts(productsRes);
      setShipments(shipmentsRes);
    } catch (err: unknown) {
      const hint = importFinanceSetupHint(err);
      setSetupHint(hint);
      setError(
        hint ??
          String(
            (err as { message?: string })?.message ?? "Failed to load import finance data",
          ),
      );
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveDraft = useCallback(
    async (
      productId: string,
      inputs: ImportFinanceInputs,
      constantsOverride?: FinanceConstants,
      clientContext?: {
        clientName?: string;
        requestRef?: string;
        chemicalTypeId?: string | null;
        customerId?: string | null;
      },
    ) => {
      setSaving(true);
      setError(null);
      try {
        const row = await saveImportShipmentDraft(
          productId,
          inputs,
          constantsOverride ?? constants,
          clientContext,
        );
        setShipments((prev) => [row, ...prev].slice(0, 20));
        return row;
      } catch (err: unknown) {
        const hint = importFinanceSetupHint(err);
        const message =
          hint ??
          String(
            (err as { message?: string })?.message ?? "Failed to save shipment",
          );
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [constants],
  );

  return {
    constants,
    products,
    shipments,
    loading,
    saving,
    error,
    setupHint,
    reload,
    saveDraft,
  };
}
