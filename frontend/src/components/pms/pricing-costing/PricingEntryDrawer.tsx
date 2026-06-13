import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, X } from "lucide-react";
import { CurrencyConverterWidget } from "./CurrencyConverterWidget";
import type {
  CRMPartner,
  PMSProduct,
  PricingRecord,
  PricingRecordInput,
} from "./types";

const LOCATIONS = ["Mombasa", "Addis Ababa", "Nairobi"] as const;
const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP"] as const;
const CURRENCIES = ["USD", "EUR", "ETB", "KES"] as const;

type PricingEntryDrawerProps = {
  open: boolean;
  mode: "add" | "update";
  sourceRecord?: PricingRecord | null;
  defaultPartnerId?: string | null;
  crmPartners: CRMPartner[];
  pmsProducts: PMSProduct[];
  onClose: () => void;
  onSave: (input: PricingRecordInput) => void;
};

function emptyForm(defaultPartnerId?: string | null): PricingRecordInput {
  return {
    crmPartnerId: defaultPartnerId ?? "",
    pmsProductId: "",
    incoterm: "FOB",
    location: "Mombasa",
    costCurrency: "USD",
    costAmount: 0,
    priceCurrency: "ETB",
    priceAmount: 0,
    exchangeRateUsed: null,
    baseCurrency: null,
  };
}

export function PricingEntryDrawer({
  open,
  mode,
  sourceRecord,
  defaultPartnerId,
  crmPartners,
  pmsProducts,
  onClose,
  onSave,
}: PricingEntryDrawerProps) {
  const [form, setForm] = useState<PricingRecordInput>(emptyForm(defaultPartnerId));

  const currenciesDiffer = form.costCurrency !== form.priceCurrency;

  useEffect(() => {
    if (!open) return;
    if (mode === "update" && sourceRecord) {
      setForm({
        crmPartnerId: sourceRecord.crmPartnerId,
        pmsProductId: sourceRecord.pmsProductId,
        incoterm: sourceRecord.incoterm,
        location: sourceRecord.location,
        costCurrency: sourceRecord.costCurrency,
        costAmount: sourceRecord.costAmount,
        priceCurrency: sourceRecord.priceCurrency,
        priceAmount: sourceRecord.priceAmount,
        exchangeRateUsed: sourceRecord.exchangeRateUsed,
        baseCurrency: sourceRecord.baseCurrency,
      });
    } else {
      setForm(emptyForm(defaultPartnerId));
    }
  }, [open, mode, sourceRecord, defaultPartnerId]);

  const fxValid = useMemo(() => {
    if (!currenciesDiffer) return true;
    return form.exchangeRateUsed != null && form.exchangeRateUsed > 0;
  }, [currenciesDiffer, form.exchangeRateUsed]);

  if (!open) return null;

  function updateCurrencyField(
    field: "costCurrency" | "priceCurrency",
    value: string,
  ) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      const mismatch = next.costCurrency !== next.priceCurrency;
      if (!mismatch) {
        return {
          ...next,
          exchangeRateUsed: null,
          baseCurrency: next.priceCurrency,
        };
      }
      return {
        ...next,
        exchangeRateUsed: null,
        baseCurrency: next.priceCurrency,
      };
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.crmPartnerId || !form.pmsProductId) return;
    if (!fxValid) return;

    const payload: PricingRecordInput = currenciesDiffer
      ? {
          ...form,
          exchangeRateUsed: form.exchangeRateUsed,
          baseCurrency: form.priceCurrency,
        }
      : {
          ...form,
          exchangeRateUsed: null,
          baseCurrency: form.priceCurrency,
        };

    onSave(payload);
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
                CRM partner
              </label>
              <select
                required
                value={form.crmPartnerId}
                disabled={isUpdate}
                onChange={(e) => setForm({ ...form, crmPartnerId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
              >
                <option value="">Select partner…</option>
                {crmPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Location
                </label>
                <select
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
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
                Cost (acquisition)
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
                Price (sell to partner)
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
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  Exchange rate at entry{" "}
                  <span className="text-rose-600">*</span>
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
                      baseCurrency: prev.priceCurrency,
                    }))
                  }
                />
                {!fxValid && (
                  <p className="text-xs text-rose-600">
                    Enter a valid exchange rate before saving.
                  </p>
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
              disabled={!fxValid}
              className="rounded-lg bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdate ? "Update pricing" : "Add entry"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
