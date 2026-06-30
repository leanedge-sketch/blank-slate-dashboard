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
import {
  type ImportFinancePipelineDomain,
  PROCUREMENT_PIPELINE_DOMAIN,
  filterShipmentsByDomain,
} from "../lib/pipelineDomains";

const RECENT_SHIPMENTS_LIMIT = 200;

export function useImportFinanceData(
  enabled = true,
  pipelineDomain: ImportFinancePipelineDomain = PROCUREMENT_PIPELINE_DOMAIN,
) {
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
        fetchRecentImportShipments(RECENT_SHIPMENTS_LIMIT, { pipelineDomain }),
      ]);
      setConstants(constantsRes);
      setProducts(productsRes);
      setShipments(filterShipmentsByDomain(shipmentsRes, pipelineDomain));
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
  }, [enabled, pipelineDomain]);

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
        contactPerson?: string;
        requestDate?: string;
        requestRef?: string;
        chemicalTypeId?: string | null;
        customerId?: string | null;
        targetCurrency?: string | null;
        salesPipelineId?: string | null;
      },
    ) => {
      setSaving(true);
      setError(null);
      try {
        const row = await saveImportShipmentDraft(
          productId,
          inputs,
          constantsOverride ?? constants,
          {
            ...clientContext,
            pipelineDomain,
          },
        );
        setShipments((prev) => [row, ...prev].slice(0, RECENT_SHIPMENTS_LIMIT));
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
    [constants, pipelineDomain],
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
    pipelineDomain,
  };
}
