import type { ReactNode } from "react";
import { ArrowRight, Users } from "lucide-react";
import {
  TRADE_CURRENCIES,
  TRADE_INCOTERMS,
  TRADE_PAYMENT_TERMS,
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

export function TradeParametersForm({
  parameters,
  onChange,
  onLoadSample,
  onContinue,
}: TradeParametersFormProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 sm:p-8 space-y-6 sm:space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <FieldGroup
          title="Core entity"
          description="Buyer identity and document reference for this transit request."
        >
          <div className="sm:col-span-2">
            <label className={labelClass}>Client</label>
            <input
              type="text"
              value={parameters.clientName}
              onChange={(e) => onChange({ clientName: e.target.value })}
              placeholder="Customer / buyer name"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Request ref</label>
            <input
              type="text"
              value={parameters.requestRef}
              onChange={(e) => onChange({ requestRef: e.target.value })}
              placeholder="PO / quote # (optional)"
              className={inputClass}
            />
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
          Parameters sync to product lines when you continue to costing.
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white hover:shadow-lg hover:shadow-cyan-500/25 transition"
        >
          Continue to product costing
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
