import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import { PartnerSelector } from "./PartnerSelector";
import { PricingDetailsMatrix } from "./PricingDetailsMatrix";
import type { CRMPartner, PMSProduct, PricingLocationInput, PricingRecordInput } from "./types";
import {
  createPricingLocationApi,
  createPricingRecordApi,
  deletePricingRecordApi,
  isPricingJunctionMissingError,
  loadPricingLocations,
  loadPricingRecords,
  mapChemicalToPMSProduct,
  mapCustomerToCRMPartner,
  revisePricingRecordApi,
} from "./pricingApi";
import { fetchCustomers, fetchSharedCatalog } from "../../../services/api";

export function PricingCostingView() {
  const [crmPartners, setCrmPartners] = useState<CRMPartner[]>([]);
  const [pmsProducts, setPmsProducts] = useState<PMSProduct[]>([]);
  const [locations, setLocations] = useState<Awaited<ReturnType<typeof loadPricingLocations>>>([]);
  const [pricingRecords, setPricingRecords] = useState<
    Awaited<ReturnType<typeof loadPricingRecords>>
  >([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);

  const reloadRecords = useCallback(async () => {
    const records = await loadPricingRecords();
    setPricingRecords(records);
    return records;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupRequired(false);
    try {
      const [customersRes, catalogRes, locs, records] = await Promise.all([
        fetchCustomers({ limit: 500 }),
        fetchSharedCatalog({ limit: 500 }),
        loadPricingLocations(),
        loadPricingRecords(),
      ]);

      const partners = (customersRes.customers ?? []).map(mapCustomerToCRMPartner);
      const products = (catalogRes.chemicals ?? []).map(mapChemicalToPMSProduct);

      setCrmPartners(partners);
      setPmsProducts(products);
      setLocations(locs);
      setPricingRecords(records);
      setSelectedPartnerId((prev) => {
        if (prev && partners.some((p) => p.id === prev)) return prev;
        return partners[0]?.id ?? null;
      });
    } catch (err) {
      if (isPricingJunctionMissingError(err)) {
        setSetupRequired(true);
        setError(
          "Pricing database tables are not set up yet. Run docs/0010_pricing_junction.sql in Supabase, then refresh.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to load pricing data.");
      }
      try {
        const [customersRes, catalogRes] = await Promise.all([
          fetchCustomers({ limit: 500 }),
          fetchSharedCatalog({ limit: 500 }),
        ]);
        setCrmPartners((customersRes.customers ?? []).map(mapCustomerToCRMPartner));
        setPmsProducts((catalogRes.chemicals ?? []).map(mapChemicalToPMSProduct));
      } catch {
        // CRM/PMS catalog errors surface in error state above.
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selectedPartner = useMemo(
    () => crmPartners.find((p) => p.id === selectedPartnerId) ?? null,
    [crmPartners, selectedPartnerId],
  );

  const partnerRecords = useMemo(
    () => pricingRecords.filter((r) => r.crmPartnerId === selectedPartnerId),
    [pricingRecords, selectedPartnerId],
  );

  const handleAddLocation = useCallback(async (input: PricingLocationInput) => {
    const created = await createPricingLocationApi(input);
    setLocations((prev) => [...prev, created]);
    return created.id;
  }, []);

  const handleAddRecord = useCallback(
    async (input: PricingRecordInput) => {
      setSaving(true);
      setError(null);
      try {
        const created = await createPricingRecordApi(input);
        setPricingRecords((prev) => [...prev, created]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save pricing entry.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const handleUpdatePricing = useCallback(
    async (sourceRecordId: string, input: PricingRecordInput) => {
      setSaving(true);
      setError(null);
      try {
        await revisePricingRecordApi(sourceRecordId, input);
        await reloadRecords();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update pricing.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [reloadRecords],
  );

  const handleDeleteRecord = useCallback(async (recordId: string) => {
    setSaving(true);
    setError(null);
    try {
      await deletePricingRecordApi(recordId);
      setPricingRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete pricing entry.");
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        <p className="text-sm">Loading CRM partners, PMS catalog, and pricing…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {error && (
        <div
          className={`mx-4 mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            setupRequired
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p>{error}</p>
            {!setupRequired && (
              <button
                type="button"
                onClick={() => loadAll()}
                className="mt-1 text-xs font-semibold underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {saving && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </span>
        </div>
      )}

      <LayoutShell
        master={
          <PartnerSelector
            partners={crmPartners}
            pricingRecords={pricingRecords}
            selectedPartnerId={selectedPartnerId}
            onSelectPartner={setSelectedPartnerId}
          />
        }
        detail={
          <PricingDetailsMatrix
            partner={selectedPartner}
            records={partnerRecords}
            pmsProducts={pmsProducts}
            crmPartners={crmPartners}
            locations={locations}
            onAddLocation={handleAddLocation}
            onAddRecord={handleAddRecord}
            onUpdatePricing={handleUpdatePricing}
            onDeleteRecord={handleDeleteRecord}
            readOnly={setupRequired}
          />
        }
      />
    </div>
  );
}
