import { useCallback, useMemo, useState } from "react";
import { LayoutShell } from "./LayoutShell";
import { PartnerSelector } from "./PartnerSelector";
import { PricingDetailsMatrix } from "./PricingDetailsMatrix";
import { MOCK_PARTNERS } from "./mockData";
import type { Partner, PricingRecordInput } from "./types";
import { newRecordId } from "./utils";

export function PricingCostingView() {
  const [partners, setPartners] = useState<Partner[]>(MOCK_PARTNERS);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    MOCK_PARTNERS[0]?.id ?? null,
  );

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId],
  );

  const updatePartnerRecords = useCallback(
    (partnerId: string, updater: (records: Partner["pricingRecords"]) => Partner["pricingRecords"]) => {
      setPartners((prev) =>
        prev.map((p) =>
          p.id === partnerId
            ? { ...p, pricingRecords: updater(p.pricingRecords) }
            : p,
        ),
      );
    },
    [],
  );

  const handleAddRecord = useCallback(
    (input: PricingRecordInput) => {
      if (!selectedPartnerId) return;
      updatePartnerRecords(selectedPartnerId, (records) => [
        ...records,
        { ...input, id: newRecordId() },
      ]);
    },
    [selectedPartnerId, updatePartnerRecords],
  );

  const handleUpdateRecord = useCallback(
    (recordId: string, input: PricingRecordInput) => {
      if (!selectedPartnerId) return;
      updatePartnerRecords(selectedPartnerId, (records) =>
        records.map((r) => (r.id === recordId ? { ...r, ...input } : r)),
      );
    },
    [selectedPartnerId, updatePartnerRecords],
  );

  const handleDeleteRecord = useCallback(
    (recordId: string) => {
      if (!selectedPartnerId) return;
      updatePartnerRecords(selectedPartnerId, (records) =>
        records.filter((r) => r.id !== recordId),
      );
    },
    [selectedPartnerId, updatePartnerRecords],
  );

  return (
    <LayoutShell
      master={
        <PartnerSelector
          partners={partners}
          selectedPartnerId={selectedPartnerId}
          onSelectPartner={setSelectedPartnerId}
        />
      }
      detail={
        <PricingDetailsMatrix
          partner={selectedPartner}
          onAddRecord={handleAddRecord}
          onUpdateRecord={handleUpdateRecord}
          onDeleteRecord={handleDeleteRecord}
        />
      }
    />
  );
}
