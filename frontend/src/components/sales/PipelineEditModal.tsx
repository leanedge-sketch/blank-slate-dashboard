import { useState } from "react";
import {
  SalesPipeline,
  SalesPipelineUpdate,
  updateSalesPipeline,
} from "../../services/api";
import { Edit2, Loader2, X, CheckCircle } from "lucide-react";
import { PipelineDealFields } from "./PipelineDealFields";
import {
  amountChangeReasonRequired,
  pipelineToDealFormValues,
  type PipelineDealFormValues,
} from "../../utils/pipelineProduct";

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
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PipelineDealFormValues>(
    pipelineToDealFormValues(pipeline),
  );
  const [amountReason, setAmountReason] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountVal =
      form.amount === "" || form.amount === null ? null : Number(form.amount);
    const amountChanged =
      amountVal !== pipeline.amount &&
      !(amountVal == null && pipeline.amount == null);

    if (
      amountChanged &&
      amountChangeReasonRequired(pipeline.stage, amountVal) &&
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
      currency: (form.currency as SalesPipelineUpdate["currency"]) || null,
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

  const amountVal =
    form.amount === "" || form.amount === null ? null : Number(form.amount);
  const amountChanged = amountVal !== pipeline.amount;
  const showAmountReason =
    amountChanged && amountChangeReasonRequired(pipeline.stage, amountVal);

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

          <PipelineDealFields
            form={form}
            onChange={setForm}
            requiredLevel="none"
          />

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
