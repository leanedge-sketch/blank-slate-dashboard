import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, UserRound, Users } from "lucide-react";
import { fetchCustomers, type Customer } from "../../../services/api";
import {
  TRADE_CURRENCIES,
  TRADE_INCOTERMS,
  TRADE_PAYMENT_TERMS,
  ensurePipelineRequestIds,
  generatePipelineRequestRef,
  validatePipelineRequestFields,
  type TradeParameters,
} from "../../../types/tradeParameters";

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-[#0B1120] px-3.5 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/40 transition";

const labelClass =
  "block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2";

type TradeParametersFormProps = {
  parameters: TradeParameters;
  onChange: (patch: Partial<TradeParameters>) => void;
  onLoadSample?: () => void;
  onContinue?: () => void;
};

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-[#111827]/80 p-5 sm:p-6 space-y-5">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-300">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-xs text-slate-500 font-light">{description}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function sortCustomers(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) =>
    (a.customer_name || "").localeCompare(b.customer_name || "", undefined, {
      sensitivity: "base",
    }),
  );
}

export function TradeParametersForm({
  parameters,
  onChange,
  onLoadSample,
  onContinue,
}: TradeParametersFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchCustomers({ limit: 1000 })
      .then((res) => {
        if (!cancelled) setCustomers(sortCustomers(res.customers ?? []));
      })
      .catch(() => {
        if (!cancelled) setCustomers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const name = (c.customer_name || "").toLowerCase();
      const id = (c.display_id || "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.customer_id === parameters.customerId),
    [customers, parameters.customerId],
  );

  const contactSuggestions = useMemo(() => {
    const names = new Set<string>();
    const primary = selectedCustomer?.primary_contact_name?.trim();
    if (primary) names.add(primary);
    for (const customer of customers) {
      const name = customer.primary_contact_name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [customers, selectedCustomer]);

  function handleCustomerPick(customerId: string) {
    if (!customerId) {
      onChange({ customerId: "" });
      return;
    }
    const customer = customers.find((c) => c.customer_id === customerId);
    const ids = ensurePipelineRequestIds({
      requestDate: parameters.requestDate,
      requestRef: parameters.requestRef,
    });
    onChange({
      customerId,
      clientName: customer?.customer_name?.trim() || parameters.clientName,
      contactPerson:
        customer?.primary_contact_name?.trim() || parameters.contactPerson,
      ...ids,
    });
  }

  function handleClientNameChange(clientName: string) {
    const trimmed = clientName.trim();
    const matched = trimmed
      ? customers.find((c) => c.customer_name?.trim() === trimmed)
      : undefined;
    const ids = ensurePipelineRequestIds({
      requestDate: parameters.requestDate,
      requestRef: parameters.requestRef,
    });
    onChange({
      clientName,
      customerId: matched?.customer_id ?? "",
      contactPerson:
        matched?.primary_contact_name?.trim() || parameters.contactPerson,
      ...ids,
    });
  }

  function handleContinue() {
    if (!parameters.customerId && !parameters.clientName.trim()) {
      window.alert("Select a CRM customer for this import request.");
      return;
    }
    const validationError = validatePipelineRequestFields(parameters);
    if (validationError) {
      window.alert(validationError);
      return;
    }
    onContinue?.();
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-8 space-y-6 sm:space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <FieldGroup
          title="Customer request"
          description="Each product line belongs to one customer request. Pick from CRM or type a buyer name."
        >
          <div className="sm:col-span-2">
            <label className={labelClass}>Search CRM customers</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Filter by name or ID…"
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>CRM customer</label>
            <select
              value={parameters.customerId}
              onChange={(e) => handleCustomerPick(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select customer —</option>
              {filteredCustomers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.customer_name}
                  {c.display_id ? ` (${c.display_id})` : ""}
                </option>
              ))}
            </select>
            {parameters.customerId ? (
              <Link
                to={`/crm/customers/${parameters.customerId}`}
                className="mt-2 inline-flex text-xs font-medium text-cyan-400 hover:text-cyan-300"
              >
                View customer in CRM →
              </Link>
            ) : filteredCustomers.length === 0 && customerSearch.trim() ? (
              <p className="mt-2 text-xs text-slate-500">
                No CRM customers match your search.
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Client name</label>
            <input
              type="text"
              list="trade-transit-client-suggestions"
              value={parameters.clientName}
              onChange={(e) => handleClientNameChange(e.target.value)}
              placeholder="Buyer name on shipments and reports"
              className={inputClass}
            />
            <datalist id="trade-transit-client-suggestions">
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_name || ""} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Contact person</label>
            <input
              type="text"
              list="trade-transit-contact-suggestions"
              value={parameters.contactPerson}
              onChange={(e) => onChange({ contactPerson: e.target.value })}
              placeholder="Pick from CRM or type a name"
              className={inputClass}
            />
            <datalist id="trade-transit-contact-suggestions">
              {contactSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {selectedCustomer?.primary_contact_name?.trim() ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <UserRound className="h-3.5 w-3.5" />
                CRM primary contact: {selectedCustomer.primary_contact_name}
                {selectedCustomer.primary_contact_phone
                  ? ` · ${selectedCustomer.primary_contact_phone}`
                  : ""}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Suggestions come from CRM primary contacts. You can also type any name.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Request date</label>
            <input
              type="date"
              value={parameters.requestDate}
              onChange={(e) => onChange({ requestDate: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Pipeline / request number</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={parameters.requestRef}
                onChange={(e) => onChange({ requestRef: e.target.value })}
                placeholder="Unique pipeline reference"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    requestRef: generatePipelineRequestRef(parameters.requestDate),
                  })
                }
                className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Generate
              </button>
            </div>
          </div>
          {onLoadSample ? (
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={onLoadSample}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 transition"
              >
                <Users className="h-4 w-4" />
                Load 2026 sample (2 products)
              </button>
            </div>
          ) : null}
        </FieldGroup>

        <FieldGroup
          title="Financial & terms"
          description="Incoterm, payment, and locked forex for capital outlay."
        >
          <div>
            <label className={labelClass}>Incoterm</label>
            <select
              value={parameters.incoterm}
              onChange={(e) =>
                onChange({ incoterm: e.target.value as TradeParameters["incoterm"] })
              }
              className={inputClass}
            >
              {TRADE_INCOTERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Payment terms</label>
            <select
              value={parameters.paymentTerms}
              onChange={(e) => onChange({ paymentTerms: e.target.value })}
              className={inputClass}
            >
              {TRADE_PAYMENT_TERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Base currency</label>
            <select
              value={parameters.baseCurrency}
              onChange={(e) => onChange({ baseCurrency: e.target.value })}
              className={inputClass}
            >
              {TRADE_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Target currency</label>
            <select
              value={parameters.targetCurrency}
              onChange={(e) => onChange({ targetCurrency: e.target.value })}
              className={inputClass}
            >
              {TRADE_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>
              Exchange rate ({parameters.targetCurrency} per 1 {parameters.baseCurrency})
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={parameters.exchangeRate}
              onChange={(e) =>
                onChange({ exchangeRate: Number(e.target.value) || 0 })
              }
              className={inputClass}
            />
          </div>
        </FieldGroup>

        <FieldGroup
          title="Logistics & timeline"
          description="Routing and quote validity for supply chain control."
        >
          <div className="sm:col-span-2">
            <label className={labelClass}>Port of loading</label>
            <input
              type="text"
              value={parameters.portOfLoading}
              onChange={(e) => onChange({ portOfLoading: e.target.value })}
              placeholder="e.g. Shanghai, CN"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Port of discharge</label>
            <input
              type="text"
              value={parameters.portOfDischarge}
              onChange={(e) => onChange({ portOfDischarge: e.target.value })}
              placeholder="e.g. Djibouti"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Quote validity</label>
            <input
              type="date"
              value={parameters.validityDate}
              onChange={(e) => onChange({ validityDate: e.target.value })}
              className={inputClass}
            />
          </div>
        </FieldGroup>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2 border-t border-slate-800">
        <p className="text-xs text-slate-500 sm:mr-auto">
          Customer, contact, and terms sync to each product line when you continue.
        </p>
        <button
          type="button"
          onClick={handleContinue}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white hover:shadow-lg hover:shadow-cyan-500/25 transition"
        >
          Continue to product costing
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
