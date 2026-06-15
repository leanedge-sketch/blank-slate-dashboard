import { useEffect, useState } from "react";
import {
  Currency,
  fetchBusinessModels,
  fetchCurrencies,
  fetchPartnerChemicals,
  fetchVendors,
} from "../../services/api";
import { useProductCatalog } from "../../contexts/ProductCatalogContext";
import { PipelinePricingSelect } from "./PipelinePricingSelect";
import type { PipelineDealFormValues, dealFormText } from "../../utils/pipelineProduct";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

function RequiredMark({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-red-500"> *</span>;
}

export function PipelineDealFields({
  form,
  onChange,
  customerId,
  requiredLevel = "none",
  showAmount = true,
  fieldsMode = "all",
}: {
  form: PipelineDealFormValues;
  onChange: (form: PipelineDealFormValues) => void;
  customerId?: string | null;
  requiredLevel?: "none" | "product_amount" | "full";
  showAmount?: boolean;
  /** When product_amount, only product, unit, and quantity are shown. */
  fieldsMode?: "all" | "product_amount";
}) {
  const { chemicals: chemicalFullData } = useProductCatalog();
  const [businessModels, setBusinessModels] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [partnerChemicals, setPartnerChemicals] = useState<
    { id: string; vendor?: string }[]
  >([]);

  useEffect(() => {
    Promise.all([
      fetchBusinessModels().catch(() => []),
      fetchCurrencies().catch(() => ["ETB", "KES", "USD", "EUR"] as Currency[]),
      fetchVendors().catch(() => []),
      fetchPartnerChemicals({ limit: 500 }).catch(() => ({
        partner_chemicals: [],
        total: 0,
      })),
    ]).then(([models, currs, vend, partners]) => {
      setBusinessModels(models || []);
      setCurrencies((currs as Currency[]) || []);
      setVendors(vend || []);
      setPartnerChemicals(partners?.partner_chemicals || []);
    });
  }, []);

  function vendorOptions(): string[] {
    const set = new Set<string>();
    vendors.forEach((v) => set.add(v));
    const productId = dealFormText(form.chemical_type_id);
    const product = chemicalFullData.find(
      (c) =>
        (c.uuid_id && dealFormText(c.uuid_id) === productId) ||
        dealFormText(c.id) === productId,
    );
    if (product?.vendor) set.add(product.vendor);
    if (product?.partner_id) {
      const pc = partnerChemicals.find((p) => p.id === product.partner_id);
      if (pc?.vendor) set.add(pc.vendor);
    }
    if (form.vendor_name) set.add(form.vendor_name);
    return Array.from(set).sort();
  }

  const reqProductAmount =
    requiredLevel === "product_amount" || requiredLevel === "full";
  const reqFull = requiredLevel === "full";
  const showAllFields = fieldsMode === "all";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className={labelClass}>
          Product
          <RequiredMark show={reqProductAmount} />
        </label>
        <select
          value={String(form.chemical_type_id ?? "")}
          onChange={(e) => onChange({ ...form, chemical_type_id: e.target.value })}
          className={inputClass}
          required={reqProductAmount}
        >
          <option value="">No product linked</option>
          {chemicalFullData
            .filter((c) => c.product_name && (c.uuid_id || c.id != null))
            .sort((a, b) =>
              (a.product_name || "").localeCompare(b.product_name || ""),
            )
            .map((c) => {
              const value = c.uuid_id ? String(c.uuid_id) : String(c.id);
              return (
                <option key={`${c.id}-${value}`} value={value}>
                  {c.product_name}
                  {c.vendor ? ` (${c.vendor})` : ""}
                </option>
              );
            })}
        </select>
      </div>

      {showAllFields && (
      <div>
        <label className={labelClass}>
          Vendor
          <RequiredMark show={reqFull} />
        </label>
        <select
          value={form.vendor_name}
          onChange={(e) => onChange({ ...form, vendor_name: e.target.value })}
          className={inputClass}
          required={reqFull}
        >
          <option value="">Select vendor…</option>
          {vendorOptions().map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      )}

      {showAllFields && (
      <div>
        <label className={labelClass}>
          Expected close date
          <RequiredMark show={reqFull} />
        </label>
        <input
          type="date"
          value={form.expected_close_date}
          onChange={(e) =>
            onChange({ ...form, expected_close_date: e.target.value })
          }
          className={inputClass}
          required={reqFull}
        />
      </div>
      )}

      {showAllFields && (
        <>
          <div>
            <label className={labelClass}>Lead source</label>
            <input
              type="text"
              value={form.lead_source}
              onChange={(e) => onChange({ ...form, lead_source: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Contact per lead</label>
            <input
              type="text"
              value={form.contact_per_lead}
              onChange={(e) =>
                onChange({ ...form, contact_per_lead: e.target.value })
              }
              className={inputClass}
            />
          </div>
        </>
      )}

      {showAllFields && (
      <div>
        <label className={labelClass}>
          Business model
          <RequiredMark show={reqFull} />
        </label>
        <select
          value={form.business_model}
          onChange={(e) => onChange({ ...form, business_model: e.target.value })}
          className={inputClass}
          required={reqFull}
        >
          <option value="">Select…</option>
          {businessModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      )}

      {showAllFields && (
      <div>
        <label className={labelClass}>
          Business unit
          <RequiredMark show={reqFull} />
        </label>
        <select
          value={form.business_unit}
          onChange={(e) => onChange({ ...form, business_unit: e.target.value })}
          className={inputClass}
          required={reqFull}
        >
          <option value="">Select…</option>
          <option value="Hayat">Hayat</option>
          <option value="Alhadi">Alhadi</option>
          <option value="Bet-chem">Bet-chem</option>
          <option value="Barracoda">Barracoda</option>
          <option value="Nyumb-Chem">Nyumb-Chem</option>
        </select>
      </div>
      )}

      <div>
        <label className={labelClass}>
          Unit
          <RequiredMark show={reqProductAmount} />
        </label>
        <select
          value={form.unit}
          onChange={(e) => onChange({ ...form, unit: e.target.value })}
          className={inputClass}
          required={reqProductAmount}
        >
          <option value="">Select…</option>
          {["kg", "ton", "g", "L", "mL", "drum", "bag", "carton", "pallet", "unit"].map(
            (u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ),
          )}
        </select>
      </div>

      {showAmount && (
        <div>
          <label className={labelClass}>
            Amount (quantity)
            <RequiredMark show={reqProductAmount} />
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount === null ? "" : form.amount}
            onChange={(e) =>
              onChange({
                ...form,
                amount: e.target.value === "" ? "" : parseFloat(e.target.value),
              })
            }
            className={inputClass}
            required={reqProductAmount}
          />
        </div>
      )}

      {showAllFields && customerId && form.chemical_type_id ? (
        <PipelinePricingSelect
          customerId={customerId}
          productId={form.chemical_type_id}
          value={form.pricing_record_id ?? null}
          onChange={(sel) => {
            if (!sel) {
              onChange({ ...form, pricing_record_id: "" });
              return;
            }
            onChange({
              ...form,
              pricing_record_id: sel.recordId,
              unit_price: sel.unitPrice,
              currency: sel.currency,
            });
          }}
        />
      ) : null}

      {showAllFields && (
      <div>
        <label className={labelClass}>
          Unit price
          <RequiredMark show={reqFull} />
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.unit_price === null ? "" : form.unit_price}
            onChange={(e) =>
              onChange({
                ...form,
                unit_price:
                  e.target.value === "" ? "" : parseFloat(e.target.value),
              })
            }
            className={`flex-1 ${inputClass}`}
            required={reqFull}
          />
          <select
            value={form.currency}
            onChange={(e) => onChange({ ...form, currency: e.target.value })}
            className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm"
            required={reqFull}
          >
            <option value="">CCY</option>
            {(currencies.length ? currencies : ["ETB", "KES", "USD", "EUR"]).map(
              (c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
      )}

      {showAllFields && (
      <div>
        <label className={labelClass}>
          Forex
          <RequiredMark show={reqFull} />
        </label>
        <select
          value={form.forex}
          onChange={(e) => onChange({ ...form, forex: e.target.value })}
          className={inputClass}
          required={reqFull}
        >
          <option value="">Select…</option>
          <option value="LeanChems">LeanChems</option>
          <option value="Client">Client</option>
        </select>
      </div>
      )}

      {showAllFields && (
      <div>
        <label className={labelClass}>
          Incoterm
          <RequiredMark show={reqFull} />
        </label>
        <select
          value={form.incoterm}
          onChange={(e) => onChange({ ...form, incoterm: e.target.value })}
          className={inputClass}
          required={reqFull}
        >
          <option value="">Select…</option>
          <option value="Import of Record">Import of Record</option>
          <option value="Agency">Agency</option>
          <option value="Direct Import">Direct Import</option>
          <option value="Stock – Addis Ababa">Stock – Addis Ababa</option>
        </select>
      </div>
      )}
    </div>
  );
}
