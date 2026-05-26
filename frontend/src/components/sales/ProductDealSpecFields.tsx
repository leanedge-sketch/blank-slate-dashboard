import type { BusinessUnit, Currency, Forex, Incoterm } from "../../services/api";
import type { ProductDealSpec } from "../../utils/pipelineProductDeals";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export function ProductDealSpecFields({
  spec,
  onChange,
  businessModels,
  currencies,
}: {
  spec: ProductDealSpec;
  onChange: (patch: Partial<ProductDealSpec>) => void;
  businessModels: string[];
  currencies: Currency[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className={labelClass}>Expected close date</label>
        <input
          type="date"
          value={spec.expected_close_date || ""}
          onChange={(e) =>
            onChange({ expected_close_date: e.target.value || null })
          }
          className={inputClass}
        />
      </div>

      <div className="md:col-span-2">
        <label className={labelClass}>
          Lead sources
          <span className="text-slate-500 font-normal"> (optional)</span>
        </label>
        <div className="space-y-2">
          {spec.leadSourceEntries.map((entry, index) => (
            <div key={`ls-${index}`} className="flex gap-2">
              <input
                type="text"
                value={entry}
                onChange={(e) => {
                  const next = [...spec.leadSourceEntries];
                  next[index] = e.target.value;
                  onChange({ leadSourceEntries: next });
                }}
                className={`flex-1 ${inputClass}`}
                placeholder="e.g., Website, Referral…"
              />
              {spec.leadSourceEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      leadSourceEntries: spec.leadSourceEntries.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                  className="px-3 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({ leadSourceEntries: [...spec.leadSourceEntries, ""] })
            }
            className="text-sm text-emerald-700 font-medium hover:text-emerald-800"
          >
            + Add lead source
          </button>
        </div>
      </div>

      <div className="md:col-span-2">
        <label className={labelClass}>
          Contacts per lead
          <span className="text-slate-500 font-normal"> (optional)</span>
        </label>
        <div className="space-y-2">
          {spec.contactPerLeadEntries.map((entry, index) => (
            <div key={`cp-${index}`} className="flex gap-2">
              <input
                type="text"
                value={entry}
                onChange={(e) => {
                  const next = [...spec.contactPerLeadEntries];
                  next[index] = e.target.value;
                  onChange({ contactPerLeadEntries: next });
                }}
                className={`flex-1 ${inputClass}`}
                placeholder="Name, role, email, or phone…"
              />
              {spec.contactPerLeadEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      contactPerLeadEntries: spec.contactPerLeadEntries.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                  className="px-3 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                contactPerLeadEntries: [...spec.contactPerLeadEntries, ""],
              })
            }
            className="text-sm text-emerald-700 font-medium hover:text-emerald-800"
          >
            + Add contact
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>Business model</label>
        <select
          value={spec.business_model || ""}
          onChange={(e) =>
            onChange({ business_model: e.target.value || null })
          }
          className={inputClass}
        >
          <option value="">Select…</option>
          {businessModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Business unit</label>
        <select
          value={spec.business_unit || ""}
          onChange={(e) =>
            onChange({
              business_unit: (e.target.value as BusinessUnit) || null,
            })
          }
          className={inputClass}
        >
          <option value="">Select…</option>
          <option value="Hayat">Hayat</option>
          <option value="Alhadi">Alhadi</option>
          <option value="Bet-chem">Bet-chem</option>
          <option value="Barracoda">Barracoda</option>
          <option value="Nyumb-Chem">Nyumb-Chem</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Unit</label>
        <select
          value={spec.unit || ""}
          onChange={(e) => onChange({ unit: e.target.value || null })}
          className={inputClass}
        >
          <option value="">Select…</option>
          <option value="kg">kg</option>
          <option value="ton">ton</option>
          <option value="g">g</option>
          <option value="L">L</option>
          <option value="mL">mL</option>
          <option value="drum">drum</option>
          <option value="bag">bag</option>
          <option value="carton">carton</option>
          <option value="pallet">pallet</option>
          <option value="unit">unit</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Amount (quantity)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={spec.amount ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              amount: v !== "" ? parseFloat(v) : null,
            });
          }}
          className={inputClass}
          placeholder="Quantity…"
        />
      </div>

      <div>
        <label className={labelClass}>Unit price</label>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={spec.unit_price ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                unit_price: v !== "" ? parseFloat(v) : null,
              });
            }}
            className={`flex-1 ${inputClass}`}
            placeholder="Price per unit…"
          />
          <select
            value={spec.currency || ""}
            onChange={(e) =>
              onChange({ currency: (e.target.value as Currency) || null })
            }
            className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">CCY</option>
            {(currencies.length ? currencies : ["ETB", "KES", "USD", "EUR"]).map(
              (curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Forex</label>
        <select
          value={spec.forex || ""}
          onChange={(e) =>
            onChange({ forex: (e.target.value as Forex) || null })
          }
          className={inputClass}
        >
          <option value="">Select…</option>
          <option value="LeanChems">LeanChems</option>
          <option value="Client">Client</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Incoterm</label>
        <select
          value={spec.incoterm || ""}
          onChange={(e) =>
            onChange({ incoterm: (e.target.value as Incoterm) || null })
          }
          className={inputClass}
        >
          <option value="">Select…</option>
          <option value="Import of Record">Import of Record</option>
          <option value="Agency">Agency</option>
          <option value="Direct Import">Direct Import</option>
          <option value="Stock – Addis Ababa">Stock – Addis Ababa</option>
        </select>
      </div>
    </div>
  );
}
