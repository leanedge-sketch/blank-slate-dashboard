import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutShell } from "./LayoutShell";
import { PartnerSelector } from "./PartnerSelector";
import { PricingDetailsMatrix } from "./PricingDetailsMatrix";
import {
  MOCK_CRM_PARTNERS,
  MOCK_PMS_PRODUCTS,
  MOCK_PRICING_RECORDS,
} from "./mockData";
import type { CRMPartner, PMSProduct, PricingRecord, PricingRecordInput } from "./types";
import { newRecordId, todayISO } from "./utils";
import { fetchCustomers, fetchSharedCatalog } from "../../../services/api";

function mapCustomersToPartners(
  customers: { customer_id: string; customer_name: string }[],
): CRMPartner[] {
  return customers.map((c) => ({
    id: c.customer_id,
    name: c.customer_name,
    type: "buyer" as const,
  }));
}

function mapCatalogToProducts(
  chemicals: {
    id: number;
    uuid_id?: string | null;
    product_name?: string | null;
    hs_code?: string | null;
    generic_name?: string | null;
  }[],
): PMSProduct[] {
  return chemicals.map((c) => ({
    id: c.uuid_id ?? String(c.id),
    sku: c.hs_code || c.generic_name || `SKU-${c.id}`,
    name: c.product_name || c.generic_name || `Product ${c.id}`,
  }));
}

export function PricingCostingView() {
  const [crmPartners, setCrmPartners] = useState<CRMPartner[]>(MOCK_CRM_PARTNERS);
  const [pmsProducts, setPmsProducts] = useState<PMSProduct[]>(MOCK_PMS_PRODUCTS);
  const [pricingRecords, setPricingRecords] = useState<PricingRecord[]>(MOCK_PRICING_RECORDS);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    MOCK_CRM_PARTNERS[0]?.id ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    async function loadCatalogs() {
      try {
        const [customersRes, catalogRes] = await Promise.all([
          fetchCustomers({ limit: 500 }),
          fetchSharedCatalog({ limit: 500 }),
        ]);
        if (cancelled) return;
        if (customersRes.customers.length > 0) {
          setCrmPartners(mapCustomersToPartners(customersRes.customers));
        }
        if (catalogRes.chemicals.length > 0) {
          setPmsProducts(mapCatalogToProducts(catalogRes.chemicals));
        }
      } catch {
        // Keep mock catalogs when API is unavailable.
      }
    }
    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPartner = useMemo(
    () => crmPartners.find((p) => p.id === selectedPartnerId) ?? null,
    [crmPartners, selectedPartnerId],
  );

  const partnerRecords = useMemo(
    () => pricingRecords.filter((r) => r.crmPartnerId === selectedPartnerId),
    [pricingRecords, selectedPartnerId],
  );

  const handleAddRecord = useCallback((input: PricingRecordInput) => {
    const today = todayISO();
    setPricingRecords((prev) => [
      ...prev,
      {
        ...input,
        id: newRecordId(),
        validFrom: today,
        validTo: null,
        status: "active",
      },
    ]);
  }, []);

  const handleUpdatePricing = useCallback(
    (sourceRecordId: string, input: PricingRecordInput) => {
      const today = todayISO();
      setPricingRecords((prev) => {
        const archived = prev.map((r) =>
          r.id === sourceRecordId
            ? { ...r, validTo: today, status: "historical" as const }
            : r,
        );
        return [
          ...archived,
          {
            ...input,
            id: newRecordId(),
            validFrom: today,
            validTo: null,
            status: "active" as const,
          },
        ];
      });
    },
    [],
  );

  const handleDeleteRecord = useCallback((recordId: string) => {
    setPricingRecords((prev) => prev.filter((r) => r.id !== recordId));
  }, []);

  return (
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
          onAddRecord={handleAddRecord}
          onUpdatePricing={handleUpdatePricing}
          onDeleteRecord={handleDeleteRecord}
        />
      }
    />
  );
}
