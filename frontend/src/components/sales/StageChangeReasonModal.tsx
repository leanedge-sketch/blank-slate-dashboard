import { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { PipelineStage } from "../../services/api";

export type PendingStageMove = {
  pipelineId: string;
  fromStage: PipelineStage;
  toStage: PipelineStage;
};

type StageChangeReasonModalProps = {
  pending: PendingStageMove | null;
  saving?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string, closeReason?: string) => void;
};

export function StageChangeReasonModal({
  pending,
  saving = false,
  error = null,
  onCancel,
  onConfirm,
}: StageChangeReasonModalProps) {
  const [reason, setReason] = useState("");
  const [closeReason, setCloseReason] = useState("");

  if (!pending) return null;

  const needsCloseReason = pending.toStage === "Closed";

  function submit() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    if (needsCloseReason && !closeReason.trim()) return;
    onConfirm(trimmed, needsCloseReason ? closeReason.trim() : undefined);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-reason-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="stage-reason-title" className="text-lg font-semibold text-slate-900">
              Confirm stage change
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {pending.fromStage} → {pending.toStage}. A justification is required
              before this deal is updated.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block text-sm font-medium text-slate-700">
            Justification <span className="text-red-500">*</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Why is this deal moving stage?"
            />
          </label>
          {needsCloseReason ? (
            <label className="block text-sm font-medium text-slate-700">
              Close reason (won) <span className="text-red-500">*</span>
              <input
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="How was this deal won?"
              />
            </label>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !reason.trim() || (needsCloseReason && !closeReason.trim())}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
