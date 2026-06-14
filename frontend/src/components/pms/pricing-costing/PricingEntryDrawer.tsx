import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, X } from "lucide-react";
import { CurrencyConverterWidget } from "./CurrencyConverterWidget";
import { CurrencySelect } from "./CurrencySelect";
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

export type PricingApplyPolicy = "keep_open_deals" | "offer_update_open_deals";

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
  onSave: (
    input: PricingRecordInput,
    options?: { applyPolicy?: PricingApplyPolicy },
  ) => void | Promise<void>;
};

function emptyForm(
  defaultPartnerId?: string | null,
  defaultLocationId?: string | null,
): PricingRecordInput & { buyerId: string; supplierId: string } {
  return {
    buyerId: defaultPartnerId ?? "",
    supplierId: "",
    crmPartnerId: defaultPartnerId ?? "",
    supplierPartnerId: null,
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

function filterProductsBySupplier(
  products: PMSProduct[],
  supplier: CRMPartner | undefined,
): PMSProduct[] {
  if (!supplier) return products;
  const name = supplier.name.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (p.partnerId && p.partnerId === supplier.id) return true;
    if (p.vendor && p.vendor.trim().toLowerCase() === name) return true;
    return false;
  });
  return filtered.length > 0 ? filtered : products;
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
  const buyers = useMemo(
    () => crmPartners.filter((p) => p.partnerKind === "crm"),
    [crmPartners],
  );
  const suppliers = useMemo(
    () => crmPartners.filter((p) => p.partnerKind === "pms"),
    [crmPartners],
  );

  const [form, setForm] = useState(emptyForm(defaultPartnerId, defaultLocationId));
  const [needsConversion, setNeedsConversion] = useState(false);
  const [marginCurrency, setMarginCurrency] = useState("");
  const [applyPolicy, setApplyPolicy] = useState<PricingApplyPolicy>("keep_open_deals");
  const [converterFrom, setConverterFrom] = useState("USD");
  const [converterTo, setConverterTo] = useState("ETB");

  const selectedSupplier = suppliers.find((s) => s.id === form.supplierId);
  const productOptions = useMemo(
    () => filterProductsBySupplier(pmsProducts, selectedSupplier),
    [pmsProducts, selectedSupplier],
  );

  const currenciesDiffer = form.costCurrency !== form.priceCurrency;

  useEffect(() => {
    if (!open) return;
    if (mode === "update" && sourceRecord) {
      const buyerId =
        sourceRecord.partnerKind === "crm" ? sourceRecord.crmPartnerId : "";
      const supplierId =
        sourceRecord.supplierPartnerId ??
        (sourceRecord.partnerKind === "pms" ? sourceRecord.crmPartnerId : "");
      setForm({
        buyerId,
        supplierId: supplierId ?? "",
        crmPartnerId: buyerId || sourceRecord.crmPartnerId,
        supplierPartnerId: supplierId || null,
        partnerKind: buyerId ? "crm" : sourceRecord.partnerKind,
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
      setConverterFrom(sourceRecord.costCurrency);
      setConverterTo(sourceRecord.priceCurrency);
      setApplyPolicy("keep_open_deals");
    } else {
      const defaultPartner = crmPartners.find((p) => p.id === defaultPartnerId);
      const isBuyer = defaultPartner?.partnerKind === "crm";
      setForm({
        ...emptyForm(defaultPartnerId, defaultLocationId ?? locations[0]?.id),
        buyerId: isBuyer ? defaultPartnerId ?? "" : "",
        supplierId: !isBuyer && defaultPartner ? defaultPartner.id : "",
        supplierPartnerId: !isBuyer && defaultPartner ? defaultPartner.id : null,
        partnerKind: isBuyer ? "crm" : "pms",
      });
      setNeedsConversion(false);
      setMarginCurrency("");
      setConverterFrom("USD");
      setConverterTo("ETB");
      setApplyPolicy("keep_open_deals");
    }
  }, [open, mode, sourceRecord, defaultPartnerId, defaultLocationId, locations, crmPartners]);

  useEffect(() => {
    if (!currenciesDiffer) {
      setNeedsConversion(false);
      setMarginCurrency(form.priceCurrency);
    } else if (!marginCurrency) {
      setMarginCurrency(form.priceCurrency);
    }
    setConverterFrom(form.costCurrency);
    setConverterTo(form.priceCurrency);
  }, [currenciesDiffer, form.priceCurrency, form.costCurrency, marginCurrency]);

  if (!open) return null;

  function syncCounterpartyFields(next: {
    buyerId?: string;
    supplierId?: string;
  }) {
    setForm((prev) => {
      const buyerId = next.buyerId ?? prev.buyerId;
      const supplierId = next.supplierId ?? prev.supplierId;
      const primaryId = buyerId || supplierId;
      return {
        ...prev,
        buyerId,
        supplierId,
        crmPartnerId: primaryId,
        supplierPartnerId: supplierId || null,
        partnerKind: buyerId ? "crm" : "pms",
        pmsProductId:
          next.supplierId !== undefined && next.supplierId !== prev.supplierId
            ? ""
            : prev.pmsProductId,
      };
    });
  }

  function handleAddLocation(input: PricingLocationInput) {
    void onAddLocation(input).then((id) => {
      setForm((prev) => ({ ...prev, locationId: id }));
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!form.buyerId && !form.supplierId) || !form.pmsProductId || !form.locationId) return;

    let payload: PricingRecordInput;

    if (!currenciesDiffer) {
      payload = {
        ...form,
        crmPartnerId: form.buyerId || form.supplierId,
        supplierPartnerId: form.supplierId || null,
        partnerKind: form.buyerId ? "crm" : "pms",
        needsCurrencyConversion: false,
        exchangeRateUsed: null,
        baseCurrency: form.priceCurrency,
      };
    } else if (!needsConversion) {
      payload = {
        ...form,
        crmPartnerId: form.buyerId || form.supplierId,
        supplierPartnerId: form.supplierId || null,
        partnerKind: form.buyerId ? "crm" : "pms",
        needsCurrencyConversion: false,
        exchangeRateUsed: null,
        baseCurrency: null,
      };
    } else {
      payload = {
        ...form,
        crmPartnerId: form.buyerId || form.supplierId,
        supplierPartnerId: form.supplierId || null,
        partnerKind: form.buyerId ? "crm" : "pms",
        needsCurrencyConversion: true,
        baseCurrency: marginCurrency || form.priceCurrency,
        exchangeRateUsed: form.exchangeRateUsed,
      };
    }

    await onSave(payload, { applyPolicy: mode === "update" ? applyPolicy : undefined });
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
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="pricing-drawer-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="pricing-drawer-title" className="text-lg font-semibold text-slate-900">
              {isUpdate ? "Update pricing" : "Add pricing entry"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Select buyer and supplier separately, then choose the product.
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
              Submitting archives the current row and creates a new active record.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Buyer
                </label>
                <select
                  value={form.buyerId}
                  disabled={isUpdate}
                  onChange={(e) => syncCounterpartyFields({ buyerId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                >
                  <option value="">Select buyer…</option>
                  {buyers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Supplier
                </label>
                <select
                  value={form.supplierId}
                  disabled={isUpdate}
                  onChange={(e) => syncCounterpartyFields({ supplierId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!form.buyerId && !form.supplierId ? (
              <p className="text-xs text-amber-700">Select at least a buyer or a supplier.</p>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Product
                {selectedSupplier ? (
                  <span className="ml-1 font-normal text-slate-400">
                    — filtered for {selectedSupplier.name}
                  </span>
                ) : null}
              </label>
              <select
                required
                value={form.pmsProductId}
                disabled={isUpdate}
                onChange={(e) => setForm({ ...form, pmsProductId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
              >
                <option value="">Select product…</option>
                {productOptions.map((p) => (
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
                Cost
              </p>
              <div className="grid grid-cols-2 gap-3">
                <CurrencySelect
                  label="Currency"
                  value={form.costCurrency}
                  onChange={(costCurrency) =>
                    setForm((prev) => ({ ...prev, costCurrency, exchangeRateUsed: null }))
                  }
                />
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.costAmount}
                    onChange={(e) =>
                      setForm({ ...form, costAmount: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sell price
              </p>
              <div className="grid grid-cols-2 gap-3">
                <CurrencySelect
                  label="Currency"
                  value={form.priceCurrency}
                  onChange={(priceCurrency) =>
                    setForm((prev) => ({ ...prev, priceCurrency, exchangeRateUsed: null }))
                  }
                />
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.priceAmount}
                    onChange={(e) =>
                      setForm({ ...form, priceAmount: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {(currenciesDiffer || needsConversion) && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-slate-600">
                    Use currency conversion for margin?
                  </legend>
                  <div className="flex gap-4">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
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
                      />
                      No
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="needs-conversion"
                        checked={needsConversion}
                        onChange={() => {
                          setNeedsConversion(true);
                          setMarginCurrency(form.priceCurrency);
                        }}
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
                        {converterFrom !== form.costCurrency &&
                        converterFrom !== form.priceCurrency ? (
                          <option value={converterFrom}>{converterFrom}</option>
                        ) : null}
                        {converterTo !== form.costCurrency &&
                        converterTo !== form.priceCurrency ? (
                          <option value={converterTo}>{converterTo}</option>
                        ) : null}
                      </select>
                    </div>
                    <CurrencyConverterWidget
                      fromCurrency={converterFrom}
                      toCurrency={converterTo}
                      amount={form.costAmount}
                      rate={form.exchangeRateUsed}
                      onRateChange={(rate) =>
                        setForm((prev) => ({ ...prev, exchangeRateUsed: rate }))
                      }
                      onFromCurrencyChange={(c) => {
                        setConverterFrom(c);
                        setForm((prev) => ({ ...prev, costCurrency: c, exchangeRateUsed: null }));
                      }}
                      onToCurrencyChange={(c) => {
                        setConverterTo(c);
                        setForm((prev) => ({ ...prev, priceCurrency: c, exchangeRateUsed: null }));
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {isUpdate && form.buyerId ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-900">Open CRM deals</p>
                <p className="text-[11px] text-blue-800">
                  Open pipeline deals keep their locked price by default. Choose whether to
                  notify owners about the new price.
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-blue-900">
                  <input
                    type="radio"
                    name="apply-policy"
                    checked={applyPolicy === "keep_open_deals"}
                    onChange={() => setApplyPolicy("keep_open_deals")}
                    className="mt-0.5"
                  />
                  <span>
                    Keep existing pricing on open deals{" "}
                    <span className="text-xs text-blue-700">(default)</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-blue-900">
                  <input
                    type="radio"
                    name="apply-policy"
                    checked={applyPolicy === "offer_update_open_deals"}
                    onChange={() => setApplyPolicy("offer_update_open_deals")}
                    className="mt-0.5"
                  />
                  <span>Notify deal owners — they can accept new pricing or keep the old</span>
                </label>
              </div>
            ) : null}
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
