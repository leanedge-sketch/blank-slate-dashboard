import { useEffect, useState } from "react";
import {
  SalesPipeline,
  SalesPipelineUpdate,
  Currency,
  updateSalesPipeline,
  fetchBusinessModels,
  fetchCurrencies,
  fetchVendors,
  fetchPartnerChemicals,
} from "../../services/api";
import { useProductCatalog } from "../../contexts/ProductCatalogContext";
import { Edit2, Loader2, X, CheckCircle } from "lucide-react";
import { amountChangeReasonRequired } from "../../utils/pipelineProduct";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export function PipelineEditModal({
  pipeline,
  onClose,
  onSaved,
}: {
  pipeline: SalesPipeline;
  onClose: () => void;
  onSaved: (updated: SalesPipeline) => void;
}) {
  const { chemicals: chemicalFullData } = useProductCatalog();
  const [saving, setSaving] = useState(false);
  const [businessModels, setBusinessModels] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [partnerChemicals, setPartnerChemicals] = useState<
    { id: string; vendor?: string }[]
  >([]);

  const meta = (pipeline.metadata || {}) as Record<string, unknown>;
  const initialVendor =
    (meta.vendor as string) || (meta.vendor_name as string) || "";

  const [form, setForm] = useState({
    chemical_type_id: pipeline.chemical_type_id || "",
    vendor_name: initialVendor,
    expected_close_date: pipeline.expected_close_date
      ? String(pipeline.expected_close_date).slice(0, 10)
      : "",
    lead_source: pipeline.lead_source || "",
    contact_per_lead: pipeline.contact_per_lead || "",
    business_model: pipeline.business_model || "",
    business_unit: pipeline.business_unit || "",
    unit: pipeline.unit || "",
    amount: pipeline.amount ?? ("" as number | ""),
    unit_price: pipeline.unit_price ?? ("" as number | ""),
    currency: pipeline.currency || "",
    forex: pipeline.forex || "",
    incoterm: pipeline.incoterm || "",
  });
  const [amountReason, setAmountReason] = useState("");

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
    const product = chemicalFullData.find(
      (c) => c.uuid_id === form.chemical_type_id,
    );
    if (product?.vendor) set.add(product.vendor);
    if (product?.partner_id) {
      const pc = partnerChemicals.find((p) => p.id === product.partner_id);
      if (pc?.vendor) set.add(pc.vendor);
    }
    if (form.vendor_name) set.add(form.vendor_name);
    return Array.from(set).sort();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountVal =
      form.amount === "" || form.amount === null
        ? null
        : Number(form.amount);
    const amountChanged =
      amountVal !== pipeline.amount &&
      !(amountVal == null && pipeline.amount == null);

    if (
      amountChanged &&
      amountChangeReasonRequired(pipeline.stage) &&
      !amountReason.trim()
    ) {
      alert("Reason for amount change is required when quantity changes.");
      return;
    }

    const metadata: Record<string, unknown> = {
      ...(pipeline.metadata || {}),
    };
    if (form.vendor_name) metadata.vendor = form.vendor_name;

    const updateData: SalesPipelineUpdate = {
      chemical_type_id: form.chemical_type_id || null,
      expected_close_date: form.expected_close_date || null,
      lead_source: form.lead_source.trim() || null,
      contact_per_lead: form.contact_per_lead.trim() || null,
      business_model: form.business_model || null,
      business_unit: (form.business_unit as SalesPipelineUpdate["business_unit"]) || null,
      unit: form.unit || null,
      amount: amountVal,
      unit_price:
        form.unit_price === "" || form.unit_price === null
          ? null
          : Number(form.unit_price),
      currency: (form.currency as Currency) || null,
      forex: (form.forex as SalesPipelineUpdate["forex"]) || null,
      incoterm: (form.incoterm as SalesPipelineUpdate["incoterm"]) || null,
      metadata,
      reason_for_amount_change: amountChanged ? amountReason : null,
    };

    try {
      setSaving(true);
      const updated = await updateSalesPipeline(pipeline.id, updateData);
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        (err as Error)?.message ||
        "Failed to save";
      alert(String(message));
    } finally {
      setSaving(false);
    }
  }

  const amountChanged =
    (form.amount === "" ? null : Number(form.amount)) !== pipeline.amount;
  const showAmountReason =
    amountChanged && amountChangeReasonRequired(pipeline.stage);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              Edit Pipeline
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Update deal details in place (product, vendor, commercial fields).
            Stage stays <strong>{pipeline.stage}</strong> — use{" "}
            <strong>Update Pipeline</strong> to change stage or create a new
            version.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm">
            <span className="text-slate-500">Current stage: </span>
            <span className="font-semibold text-slate-900">{pipeline.stage}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Product</label>
              <select
                value={form.chemical_type_id}
                onChange={(e) =>
                  setForm({ ...form, chemical_type_id: e.target.value })
                }
                className={inputClass}
              >
                <option value="">No product linked</option>
                {chemicalFullData
                  .filter((c) => c.product_name && c.uuid_id)
                  .sort((a, b) =>
                    (a.product_name || "").localeCompare(b.product_name || ""),
                  )
                  .map((c) => (
                    <option key={c.uuid_id} value={c.uuid_id as string}>
                      {c.product_name}
                      {c.vendor ? ` (${c.vendor})` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Vendor</label>
              <select
                value={form.vendor_name}
                onChange={(e) =>
                  setForm({ ...form, vendor_name: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Select vendor…</option>
                {vendorOptions().map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Expected close date</label>
              <input
                type="date"
                value={form.expected_close_date}
                onChange={(e) =>
                  setForm({ ...form, expected_close_date: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Lead source</label>
              <input
                type="text"
                value={form.lead_source}
                onChange={(e) =>
                  setForm({ ...form, lead_source: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Contact per lead</label>
              <input
                type="text"
                value={form.contact_per_lead}
                onChange={(e) =>
                  setForm({ ...form, contact_per_lead: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Business model</label>
              <select
                value={form.business_model}
                onChange={(e) =>
                  setForm({ ...form, business_model: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Select…</option>
                {businessModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Business unit</label>
              <select
                value={form.business_unit}
                onChange={(e) =>
                  setForm({ ...form, business_unit: e.target.value })
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
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className={inputClass}
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

            <div>
              <label className={labelClass}>Amount (quantity)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount === null ? "" : form.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    amount: e.target.value === "" ? "" : parseFloat(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Unit price</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unit_price === null ? "" : form.unit_price}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      unit_price:
                        e.target.value === "" ? "" : parseFloat(e.target.value),
                    })
                  }
                  className={`flex-1 ${inputClass}`}
                />
                <select
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                  className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm"
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

            <div>
              <label className={labelClass}>Forex</label>
              <select
                value={form.forex}
                onChange={(e) => setForm({ ...form, forex: e.target.value })}
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
                value={form.incoterm}
                onChange={(e) => setForm({ ...form, incoterm: e.target.value })}
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

          {showAmountReason && (
            <div>
              <label className={labelClass}>
                Reason for amount change <span className="text-red-500">*</span>
              </label>
              <textarea
                value={amountReason}
                onChange={(e) => setAmountReason(e.target.value)}
                required
                rows={2}
                className={inputClass}
                placeholder="Why is the quantity changing?"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
