import {
  formatPipelineQuantity,
  type PipelineStageUpdateEntry,
} from "../../utils/pipelineProduct";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function PipelineStageUpdateList({
  updates,
  onSelectVersion,
}: {
  updates: PipelineStageUpdateEntry[];
  onSelectVersion?: (versionId: string) => void;
}) {
  if (!updates.length) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Updates ({updates.length})
      </p>
      <ul className="space-y-2">
        {updates.map((entry) => (
          <li key={entry.versionId}>
            <button
              type="button"
              onClick={() => onSelectVersion?.(entry.versionId)}
              className={`w-full text-left rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 transition-colors ${
                onSelectVersion
                  ? "hover:border-blue-300 hover:bg-blue-50/60 cursor-pointer"
                  : "cursor-default"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                <span className="text-xs font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  V{entry.versionNumber}
                </span>
                <span className="text-xs text-slate-500">{formatWhen(entry.createdAt)}</span>
              </div>

              {entry.isInitial ? (
                <p className="text-sm font-medium text-slate-800">Deal created</p>
              ) : entry.stageChanged && entry.fromStage ? (
                <p className="text-sm font-medium text-slate-800">
                  {entry.fromStage} → {entry.stage}
                </p>
              ) : entry.amountChanged ? (
                <p className="text-sm font-medium text-slate-800">Quantity updated</p>
              ) : (
                <p className="text-sm font-medium text-slate-800">Pipeline updated</p>
              )}

              {entry.amountChanged && (
                <p className="text-xs text-slate-600 mt-1">
                  Amount: {formatPipelineQuantity(entry.previousAmount, entry.unit)} →{" "}
                  {formatPipelineQuantity(entry.amount, entry.unit)}
                </p>
              )}

              {!entry.amountChanged && entry.amount != null && entry.isInitial && (
                <p className="text-xs text-slate-600 mt-1">
                  Amount: {formatPipelineQuantity(entry.amount, entry.unit)}
                </p>
              )}

              {entry.stageChangeReason && (
                <p className="text-xs text-blue-800 mt-1.5 leading-relaxed">
                  <span className="font-semibold">Stage reason:</span>{" "}
                  {entry.stageChangeReason}
                </p>
              )}

              {entry.amountChangeReason && (
                <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                  <span className="font-semibold">Amount reason:</span>{" "}
                  {entry.amountChangeReason}
                </p>
              )}

              {entry.closeReason && (
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  <span className="font-semibold">Close reason:</span> {entry.closeReason}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
