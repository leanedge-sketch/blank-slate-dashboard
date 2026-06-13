import { useMemo, useState } from "react";
import {
  Building2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Partner, PricingRecord, PricingRecordInput } from "./types";
import { CurrencyBadge } from "./CurrencyBadge";
import { AddPricingEntryModal } from "./AddPricingEntryModal";
import { formatAmount, groupRecordsByLocation } from "./utils";

type PricingDetailsMatrixProps = {
  partner: Partner | null;
  onAddRecord: (input: PricingRecordInput) => void;
  onUpdateRecord: (recordId: string, input: PricingRecordInput) => void;
  onDeleteRecord: (recordId: string) => void;
};

export function PricingDetailsMatrix({
  partner,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
}: PricingDetailsMatrixProps) {
  const groups = useMemo(
    () => (partner ? groupRecordsByLocation(partner.pricingRecords) : []),
    [partner],
  );

  const [activeLocation, setActiveLocation] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PricingRecord | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const effectiveTab =
    activeLocation && groups.some((g) => g.location === activeLocation)
      ? activeLocation
      : groups[0]?.location ?? "";

  const activeGroup = groups.find((g) => g.location === effectiveTab);

  if (!partner) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Building2 className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">
          Select a partner
        </h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Choose a partner from the sidebar to view pricing and costing by
          location and incoterm.
        </p>
      </div>
    );
  }

  function openAdd() {
    setEditingRecord(null);
    setModalOpen(true);
  }

  function openEdit(record: PricingRecord) {
    setEditingRecord(record);
    setModalOpen(true);
    setOpenMenuId(null);
  }

  function handleSave(input: PricingRecordInput) {
    if (editingRecord) {
      onUpdateRecord(editingRecord.id, input);
    } else {
      onAddRecord(input);
      setActiveLocation(input.location);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{partner.name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{partner.activeTOS}</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md transition-shadow"
          >
            <Plus className="h-4 w-4" />
            Add pricing entry
          </button>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <MapPin className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No pricing entries yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Add your first incoterm row for this partner.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 text-sm font-semibold text-orange-700 hover:text-orange-800"
          >
            + Add pricing entry
          </button>
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/60 px-4 pt-3">
            <div className="flex gap-1 overflow-x-auto pb-0">
              {groups.map(({ location, records }) => {
                const active = location === effectiveTab;
                return (
                  <button
                    key={location}
                    type="button"
                    onClick={() => setActiveLocation(location)}
                    className={`shrink-0 rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-slate-200 bg-white text-orange-700"
                        : "border-transparent bg-transparent text-slate-600 hover:bg-white/60"
                    }`}
                  >
                    {location}
                    <span
                      className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                        active ? "bg-orange-100 text-orange-800" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {records.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-white p-4 sm:p-6">
            {activeGroup && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Incoterm</th>
                      <th className="px-4 py-3">Cost</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3 w-16 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeGroup.records.map((record) => (
                      <tr
                        key={record.id}
                        className="group hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {record.incoterm}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CurrencyBadge currency={record.costCurrency} variant="cost" />
                            <span className="tabular-nums text-slate-800">
                              {formatAmount(record.costAmount)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CurrencyBadge currency={record.priceCurrency} variant="price" />
                            <span className="tabular-nums text-slate-800">
                              {formatAmount(record.priceAmount)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="relative inline-flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMenuId((id) =>
                                  id === record.id ? null : record.id,
                                )
                              }
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              aria-label="Row actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {openMenuId === record.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setOpenMenuId(null)}
                                  aria-hidden
                                />
                                <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                  <button
                                    type="button"
                                    onClick={() => openEdit(record)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Delete ${record.incoterm} @ ${record.location}?`,
                                        )
                                      ) {
                                        onDeleteRecord(record.id);
                                      }
                                      setOpenMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <AddPricingEntryModal
        open={modalOpen}
        partnerName={partner.name}
        initial={editingRecord}
        onClose={() => {
          setModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
