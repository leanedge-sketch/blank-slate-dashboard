import { FormEvent, useEffect, useState } from "react";
import { Archive, X } from "lucide-react";
import { CurrencyConverterWidget } from "./CurrencyConverterWidget";
import { LocationPicker } from "./LocationPicker";
import type {
  CRMPartner,
  PMSProduct,
  PricingLocation,
  PricingLocationInput,
  PricingRecord,
  PricingRecordInput,
} from "./types";

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "ETB", "KES", "CNY"] as const;

type PricingEntryDrawerProps = {
  open: boolean;
  mode: "add" | "update";
  sourceRecord?: PricingRecord | null;
  defaultPartnerId?: string | null;
  defaultLocationId?: string | null;
  crmPartners: CRMPartner[];
  pmsProducts: PMSProduct[];
  locations: PricingLocation[];
  onAddLocation: (location: PricingLocationInput) => Promise<string>;
  onClose: () => void;
  onSave: (input: PricingRecordInput) => void | Promise<void>;
};

function emptyForm(
  defaultPartnerId?: string | null,
  defaultLocationId?: string | null,
): PricingRecordInput {
  return {
    crmPartnerId: defaultPartnerId ?? "",
    partnerKind: "crm",
    pmsProductId: "",
    incoterm: "FOB",
    locationId: defaultLocationId ?? "",
    costCurrency: "USD",
    costAmount: 0,
    priceCurrency: "ETB",
    priceAmount: 0,
    needsCurrencyConversion: false,
    exchangeRateUsed: null,
    baseCurrency: null,
  };
}

export function PricingEntryDrawer({
  open,
  mode,
  sourceRecord,
  defaultPartnerId,
  defaultLocationId,
  crmPartners,
  pmsProducts,
  locations,
  onAddLocation,
  onClose,
  onSave,
}: PricingEntryDrawerProps) {
  const [form, setForm] = useState<PricingRecordInput>(
    emptyForm(defaultPartnerId, defaultLocationId),
  );
  const [needsConversion, setNeedsConversion] = useState(false);
  const [marginCurrency, setMarginCurrency] = useState("");

  const currenciesDiffer = form.costCurrency !== form.priceCurrency;

  useEffect(() => {
    if (!open) return;
    if (mode === "update" && sourceRecord) {
      setForm({
        crmPartnerId: sourceRecord.crmPartnerId,
        partnerKind: sourceRecord.partnerKind,
        pmsProductId: sourceRecord.pmsProductId,
        incoterm: sourceRecord.incoterm,
        locationId: sourceRecord.locationId,
        costCurrency: sourceRecord.costCurrency,
        costAmount: sourceRecord.costAmount,
        priceCurrency: sourceRecord.priceCurrency,
        priceAmount: sourceRecord.priceAmount,
        needsCurrencyConversion: sourceRecord.needsCurrencyConversion,
        exchangeRateUsed: sourceRecord.exchangeRateUsed,
        baseCurrency: sourceRecord.baseCurrency,
      });
      setNeedsConversion(sourceRecord.needsCurrencyConversion);
      setMarginCurrency(
        sourceRecord.baseCurrency ??
          sourceRecord.priceCurrency ??
          sourceRecord.costCurrency,
      );
    } else {
      const defaultPartner = crmPartners.find((p) => p.id === defaultPartnerId);
      setForm({
        ...emptyForm(defaultPartnerId, defaultLocationId ?? locations[0]?.id),
        partnerKind: defaultPartner?.partnerKind ?? "crm",
      });
      setNeedsConversion(false);
      setMarginCurrency("");
    }
  }, [open, mode, sourceRecord, defaultPartnerId, defaultLocationId, locations, crmPartners]);

  useEffect(() => {
    if (!currenciesDiffer) {
      setNeedsConversion(false);
      setMarginCurrency(form.priceCurrency);
    } else if (!marginCurrency) {
      setMarginCurrency(form.priceCurrency);
    }
  }, [currenciesDiffer, form.priceCurrency, form.costCurrency, marginCurrency]);

  if (!open) return null;

  function updateCurrencyField(
    field: "costCurrency" | "priceCurrency",
    value: string,
  ) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (next.costCurrency === next.priceCurrency) {
        return {
          ...next,
          needsCurrencyConversion: false,
          exchangeRateUsed: null,
          baseCurrency: next.priceCurrency,
        };
      }
      return {
        ...next,
        exchangeRateUsed: null,
        baseCurrency: null,
      };
    });
    if (field === "priceCurrency" || value === form.costCurrency) {
      setMarginCurrency(value === form.costCurrency ? form.priceCurrency : value);
    }
  }

  function handleAddLocation(input: PricingLocationInput) {
    void onAddLocation(input).then((id) => {
      setForm((prev) => ({ ...prev, locationId: id }));
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.crmPartnerId || !form.pmsProductId || !form.locationId) return;

    let payload: PricingRecordInput;

    if (!currenciesDiffer) {
      payload = {
        ...form,
        needsCurrencyConversion: false,
        exchangeRateUsed: null,
        baseCurrency: form.priceCurrency,
      };
    } else if (!needsConversion) {
      payload = {
        ...form,
        needsCurrencyConversion: false,
        exchangeRateUsed: null,
        baseCurrency: null,
      };
    } else {
      payload = {
        ...form,
        needsCurrencyConversion: true,
        baseCurrency: marginCurrency || form.priceCurrency,
        exchangeRateUsed: form.exchangeRateUsed,
      };
    }

    await onSave(payload);
    onClose();
  }

  const isUpdate = mode === "update";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="pricing-drawer-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="pricing-drawer-title" className="text-lg font-semibold text-slate-900">
              {isUpdate ? "Update pricing" : "Add pricing entry"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isUpdate
                ? "Creates a new active price and archives the current record."
                : "Link a CRM partner to a PMS product with cost and sell price."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isUpdate && (
          <div className="mx-5 mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Archive className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              Submitting will set the current price&apos;s end date to today and mark it{" "}
              <span className="font-semibold">historical</span>. A new{" "}
              <span className="font-semibold">active</span> record will be created with
              today as the start date.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Counterparty (CRM buyer or PMS provider)
              </label>
              <select
                required
                value={form.crmPartnerId}
                disabled={isUpdate}
                onChange={(e) => {
                  const partner = crmPartners.find((p) => p.id === e.target.value);
                  setForm({
                    ...form,
                    crmPartnerId: e.target.value,
                    partnerKind: partner?.partnerKind ?? "crm",
                  });
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
              >
                <option value="">Select partner…</option>
                {crmPartners.map((p) => (
                  <option key={`${p.partnerKind}-${p.id}`} value={p.id}>
                    [{p.type}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                PMS product
              </label>
              <select
                required
                value={form.pmsProductId}
                disabled={isUpdate}
                onChange={(e) => setForm({ ...form, pmsProductId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
              >
                <option value="">Select product…</option>
                {pmsProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
              <div className="sm:col-span-2">
                <LocationPicker
                  locations={locations}
                  value={form.locationId}
                  onChange={(locationId) => setForm({ ...form, locationId })}
                  onAddLocation={handleAddLocation}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Incoterm
                </label>
                <select
                  value={form.incoterm}
                  onChange={(e) => setForm({ ...form, incoterm: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                >
                  {INCOTERMS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cost currency & amount
              </p>
              <p className="text-[11px] text-slate-500">
                Currency you pay / acquire in
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Currency</label>
                  <select
                    value={form.costCurrency}
                    onChange={(e) => updateCurrencyField("costCurrency", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.costAmount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        costAmount: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Price currency & amount
              </p>
              <p className="text-[11px] text-slate-500">
                Currency you sell to the partner in
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Currency</label>
                  <select
                    value={form.priceCurrency}
                    onChange={(e) => updateCurrencyField("priceCurrency", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.priceAmount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        priceAmount: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {currenciesDiffer && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-medium text-slate-700">
                  Cost is in <span className="font-semibold">{form.costCurrency}</span> and
                  price is in <span className="font-semibold">{form.priceCurrency}</span>.
                </p>
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-slate-600">
                    Is currency conversion needed for margin calculation?
                  </legend>
                  <div className="flex gap-4">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="needs-conversion"
                        checked={!needsConversion}
                        onChange={() => {
                          setNeedsConversion(false);
                          setForm((prev) => ({
                            ...prev,
                            exchangeRateUsed: null,
                            baseCurrency: null,
                          }));
                        }}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      No
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="needs-conversion"
                        checked={needsConversion}
                        onChange={() => {
                          setNeedsConversion(true);
                          setMarginCurrency(form.priceCurrency);
                        }}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      Yes
                    </label>
                  </div>
                </fieldset>

                {needsConversion && (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Display margin in
                      </label>
                      <select
                        value={marginCurrency}
                        onChange={(e) => setMarginCurrency(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value={form.costCurrency}>{form.costCurrency}</option>
                        <option value={form.priceCurrency}>{form.priceCurrency}</option>
                      </select>
                    </div>
                    <div>
                      <p className="mb-2 text-xs text-slate-500">
                        Exchange rate <span className="text-slate-400">(optional)</span> — lock
                        a rate for this record if known
                      </p>
                      <CurrencyConverterWidget
                        fromCurrency={form.costCurrency}
                        toCurrency={form.priceCurrency}
                        amount={form.costAmount}
                        rate={form.exchangeRateUsed}
                        onRateChange={(rate) =>
                          setForm((prev) => ({
                            ...prev,
                            exchangeRateUsed: rate,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-md"
            >
              {isUpdate ? "Update pricing" : "Add entry"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
