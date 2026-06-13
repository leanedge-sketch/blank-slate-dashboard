import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { PricingRecord, PricingRecordInput } from "./types";

const LOCATIONS = ["Mombasa", "Addis Ababa", "Nairobi"] as const;
const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP"] as const;
const CURRENCIES = ["USD", "EUR", "ETB", "KES"] as const;

type AddPricingEntryModalProps = {
  open: boolean;
  partnerName: string;
  initial?: PricingRecord | null;
  onClose: () => void;
  onSave: (input: PricingRecordInput) => void;
};

const emptyForm = (): PricingRecordInput => ({
  incoterm: "FOB",
  location: "Mombasa",
  costCurrency: "USD",
  costAmount: null,
  priceCurrency: "ETB",
  priceAmount: null,
});

export function AddPricingEntryModal({
  open,
  partnerName,
  initial,
  onClose,
  onSave,
}: AddPricingEntryModalProps) {
  const [form, setForm] = useState<PricingRecordInput>(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        incoterm: initial.incoterm,
        location: initial.location,
        costCurrency: initial.costCurrency,
        costAmount: initial.costAmount,
        priceCurrency: initial.priceCurrency,
        priceAmount: initial.priceAmount,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, initial]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-labelledby="pricing-entry-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="pricing-entry-title" className="text-lg font-semibold text-slate-900">
              {initial ? "Edit pricing entry" : "Add pricing entry"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{partnerName}</p>
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

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
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
              Cost
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600">Currency</label>
                <select
                  value={form.costCurrency}
                  onChange={(e) =>
                    setForm({ ...form, costCurrency: e.target.value })
                  }
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
                  value={form.costAmount ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      costAmount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Price
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600">Currency</label>
                <select
                  value={form.priceCurrency}
                  onChange={(e) =>
                    setForm({ ...form, priceCurrency: e.target.value })
                  }
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
                  value={form.priceAmount ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priceAmount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
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
              {initial ? "Save changes" : "Add entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
