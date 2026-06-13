import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  CRMPartner,
  PMSProduct,
  PricingRecord,
  PricingRecordInput,
} from "./types";
import { CurrencyBadge } from "./CurrencyBadge";
import { CurrencyConverterWidget } from "./CurrencyConverterWidget";
import { PricingEntryDrawer } from "./PricingEntryDrawer";
import {
  computeMargin,
  formatAmount,
  groupRecordsByLocation,
  partnerTypeLabel,
  type MarginComputeOptions,
} from "./utils";

type PricingDetailsMatrixProps = {
  partner: CRMPartner | null;
  records: PricingRecord[];
  pmsProducts: PMSProduct[];
  crmPartners: CRMPartner[];
  onAddRecord: (input: PricingRecordInput) => void;
  onUpdatePricing: (sourceRecordId: string, input: PricingRecordInput) => void;
  onDeleteRecord: (recordId: string) => void;
};

function StatusBadge({ status }: { status: PricingRecord["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        Active
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
        Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
      Historical
    </span>
  );
}

type MarginCellProps = {
  record: PricingRecord;
  marginOptions?: MarginComputeOptions;
};

function MarginCell({ record, marginOptions }: MarginCellProps) {
  const margin = computeMargin(record, marginOptions);

  if (margin.missingRate) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-amber-700"
        title="No exchange rate recorded for this entry."
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="text-slate-500">N/A</span>
      </span>
    );
  }

  const value = margin.amount ?? 0;
  const positive = value >= 0;

  let colorClass: string;
  if (margin.simulated) {
    colorClass = "text-amber-600";
  } else if (positive) {
    colorClass = "text-emerald-700";
  } else {
    colorClass = "text-rose-700";
  }

  return (
    <span
      className={`tabular-nums font-medium ${colorClass}`}
      title={
        margin.rateLabel
          ? margin.simulated
            ? `Simulated at ${margin.rateLabel}`
            : `Calculated at ${margin.rateLabel}`
          : undefined
      }
    >
      {value >= 0 ? "+" : ""}
      {formatAmount(value)} {margin.currency}
      {margin.simulated && (
        <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-amber-500">
          sim
        </span>
      )}
    </span>
  );
}

function defaultSimulatePair(records: PricingRecord[]): {
  from: string;
  to: string;
  rate: number | null;
} {
  const cross = records.find((r) => r.costCurrency !== r.priceCurrency);
  if (cross) {
    return {
      from: cross.costCurrency,
      to: cross.priceCurrency,
      rate: cross.exchangeRateUsed,
    };
  }
  return { from: "USD", to: "KES", rate: 129.5 };
}

export function PricingDetailsMatrix({
  partner,
  records,
  pmsProducts,
  crmPartners,
  onAddRecord,
  onUpdatePricing,
  onDeleteRecord,
}: PricingDetailsMatrixProps) {
  const [showHistorical, setShowHistorical] = useState(false);
  const [simulateLive, setSimulateLive] = useState(false);
  const [simulateFrom, setSimulateFrom] = useState("USD");
  const [simulateTo, setSimulateTo] = useState("KES");
  const [liveRate, setLiveRate] = useState<number | null>(129.5);
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "update">("add");
  const [sourceRecord, setSourceRecord] = useState<PricingRecord | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const productById = useMemo(() => {
    const map = new Map<string, PMSProduct>();
    for (const p of pmsProducts) map.set(p.id, p);
    return map;
  }, [pmsProducts]);

  const visibleRecords = useMemo(
    () =>
      showHistorical ? records : records.filter((r) => r.status === "active"),
    [records, showHistorical],
  );

  useEffect(() => {
    const pair = defaultSimulatePair(records);
    setSimulateFrom(pair.from);
    setSimulateTo(pair.to);
    setLiveRate(pair.rate);
  }, [partner?.id, records]);

  const marginOptions: MarginComputeOptions | undefined = simulateLive
    ? {
        simulate: true,
        liveRate,
        liveFromCurrency: simulateFrom,
        liveToCurrency: simulateTo,
      }
    : undefined;

  const groups = useMemo(
    () => groupRecordsByLocation(visibleRecords),
    [visibleRecords],
  );

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
          Select a CRM partner
        </h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Choose a partner from the sidebar to view product pricing, margins, and
          validity windows.
        </p>
      </div>
    );
  }

  function openAdd() {
    setDrawerMode("add");
    setSourceRecord(null);
    setDrawerOpen(true);
  }

  function openUpdate(record: PricingRecord) {
    setDrawerMode("update");
    setSourceRecord(record);
    setDrawerOpen(true);
    setOpenMenuId(null);
  }

  function handleSave(input: PricingRecordInput) {
    if (drawerMode === "update" && sourceRecord) {
      onUpdatePricing(sourceRecord.id, input);
    } else {
      onAddRecord(input);
      setActiveLocation(input.location);
    }
  }

  function productLabel(productId: string): string {
    const product = productById.get(productId);
    if (!product) return "Unknown product";
    return `${product.sku} — ${product.name}`;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{partner.name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {partnerTypeLabel(partner.type)} · CRM ↔ PMS pricing junction
            </p>
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

      <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showHistorical}
                onChange={(e) => setShowHistorical(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              Show historical data
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={simulateLive}
                onChange={(e) => setSimulateLive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              Simulate live margins
            </label>
          </div>
          <p className="text-xs text-slate-500">
            {visibleRecords.length} record{visibleRecords.length === 1 ? "" : "s"}
            {!showHistorical && records.length > visibleRecords.length
              ? ` (${records.length - visibleRecords.length} hidden)`
              : ""}
          </p>
        </div>

        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            simulateLive ? "grid-rows-[1fr] mt-3" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="mb-2 text-xs font-medium text-amber-900">
                Live FX projection — display only; stored rates are unchanged.
              </p>
              <CurrencyConverterWidget
                fromCurrency={simulateFrom}
                toCurrency={simulateTo}
                rate={liveRate}
                onRateChange={setLiveRate}
                currenciesReadOnly={false}
                onFromCurrencyChange={setSimulateFrom}
                onToCurrencyChange={setSimulateTo}
              />
            </div>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <MapPin className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No pricing entries yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {showHistorical
              ? "No records for this partner."
              : "Add your first active price or enable historical data."}
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
              {groups.map(({ location, records: locRecords }) => {
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
                      {locRecords.length}
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
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Incoterm</th>
                      <th className="px-4 py-3">Cost</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Margin</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 w-16 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeGroup.records.map((record) => {
                      const isHistorical = record.status === "historical";
                      return (
                        <tr
                          key={record.id}
                          className={`group transition-colors hover:bg-slate-50/80 ${
                            isHistorical ? "text-slate-500" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <p
                              className={`font-medium ${isHistorical ? "text-slate-500" : "text-slate-900"}`}
                            >
                              {productById.get(record.pmsProductId)?.sku ?? "—"}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {productById.get(record.pmsProductId)?.name ?? record.pmsProductId}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-medium">{record.incoterm}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CurrencyBadge currency={record.costCurrency} variant="cost" />
                              <span className="tabular-nums">
                                {formatAmount(record.costAmount)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CurrencyBadge currency={record.priceCurrency} variant="price" />
                              <span className="tabular-nums">
                                {formatAmount(record.priceAmount)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <MarginCell record={record} marginOptions={marginOptions} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={record.status} />
                            {record.validFrom && (
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {record.validFrom}
                                {record.validTo ? ` → ${record.validTo}` : " → present"}
                              </p>
                            )}
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
                                  <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                    {record.status === "active" && (
                                      <button
                                        type="button"
                                        onClick={() => openUpdate(record)}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Update pricing
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Delete ${productLabel(record.pmsProductId)} @ ${record.location}?`,
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <PricingEntryDrawer
        open={drawerOpen}
        mode={drawerMode}
        sourceRecord={sourceRecord}
        defaultPartnerId={partner.id}
        crmPartners={crmPartners}
        pmsProducts={pmsProducts}
        onClose={() => {
          setDrawerOpen(false);
          setSourceRecord(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
