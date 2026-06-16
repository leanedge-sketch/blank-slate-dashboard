import {
  Component,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { SalesPipeline, updateSalesPipeline } from "../../services/api";
import { Edit2, Loader2, X, CheckCircle } from "lucide-react";
import { PipelineDealFields } from "./PipelineDealFields";
import { formatApiErrorDetail } from "../../utils/apiErrors";
import {
  amountChangeReasonRequired,
  buildInPlacePipelineUpdatePayload,
  pipelineAmountsDiffer,
  pipelineStageRequiresProductAndAmount,
  pipelineToDealFormValues,
  STAGES_REQUIRING_FULL_COMMERCIAL,
  validateInPlacePipelineSave,
  type PipelineDealFormValues,
} from "../../utils/pipelineProduct";
import type { ChemicalFullData } from "../../services/api";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

class EditModalErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PipelineEditModal crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-center space-y-4 bg-white rounded-xl max-w-lg mx-auto mt-24">
          <p className="text-red-600 font-semibold">Could not open Edit Pipeline</p>
          <p className="text-sm text-slate-600 break-words">{this.state.error.message}</p>
          <button
            type="button"
            onClick={this.props.onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PipelineEditModal({
  pipeline,
  chemicals,
  onClose,
  onSaved,
}: {
  pipeline: SalesPipeline;
  chemicals: ChemicalFullData[];
  onClose: () => void;
  onSaved: (updated: SalesPipeline) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PipelineDealFormValues>(() =>
    pipelineToDealFormValues(pipeline, chemicals),
  );
  const [amountReason, setAmountReason] = useState("");
  const amountReasonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setForm(pipelineToDealFormValues(pipeline, chemicals));
    setAmountReason("");
  }, [pipeline.id, pipeline.stage, chemicals]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateInPlacePipelineSave(form, pipeline, {
      amountReason,
    });
    if (validationError) {
      alert(validationError);
      if (
        validationError.includes("Reason for amount change") &&
        amountReasonRef.current
      ) {
        amountReasonRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      return;
    }
    const amountVal =
      form.amount === "" || form.amount === null ? null : Number(form.amount);
    const amountChanged = pipelineAmountsDiffer(amountVal, pipeline.amount);

    const updateData = buildInPlacePipelineUpdatePayload(pipeline, form, {
      amountChanged,
      amountVal,
      amountReason: amountReason.trim() || undefined,
    });

    if (!amountChanged && Object.keys(updateData).length === 0) {
      alert("No changes to save.");
      return;
    }

    try {
      setSaving(true);
      const updated = await updateSalesPipeline(pipeline.id, updateData);
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      alert(formatApiErrorDetail(err, "Failed to save pipeline edits"));
    } finally {
      setSaving(false);
    }
  }

  const amountVal =
    form.amount === "" || form.amount === null ? null : Number(form.amount);
  const amountChanged = pipelineAmountsDiffer(amountVal, pipeline.amount);
  const showAmountReason =
    amountChanged && amountChangeReasonRequired(pipeline.stage, amountVal);

  useEffect(() => {
    if (showAmountReason && amountReasonRef.current) {
      amountReasonRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [showAmountReason]);

  const modal = (
    <EditModalErrorBoundary onClose={onClose}>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pipeline-edit-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2
                id="pipeline-edit-title"
                className="text-xl font-semibold text-slate-900 flex items-center gap-2"
              >
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
              chemicals={chemicals}
              customerId={
                pipeline.customer_id ? String(pipeline.customer_id) : undefined
              }
              requiredLevel={
                (STAGES_REQUIRING_FULL_COMMERCIAL as readonly string[]).includes(
                  pipeline.stage,
                )
                  ? "full"
                  : pipelineStageRequiresProductAndAmount(pipeline.stage)
                    ? "product_amount"
                    : "none"
              }
              fieldsMode="all"
              showPricingSelect={false}
            />

            {showAmountReason && (
              <div
                ref={amountReasonRef}
                className="rounded-lg border border-amber-200 bg-amber-50/80 p-4"
              >
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
    </EditModalErrorBoundary>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
