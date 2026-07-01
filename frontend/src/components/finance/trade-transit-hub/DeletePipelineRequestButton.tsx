import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { notifyPipelineDeleted } from "../../../lib/importFinanceEvents";
import { deleteImportPipelineShipments } from "../../../services/importFinance";
import type { PipelineSnapshotGroup } from "../../../utils/pipelineSnapshotGroups";

type DeletePipelineRequestButtonProps = {
  group: PipelineSnapshotGroup;
  onDeleted?: (deletedIds: string[]) => void;
  className?: string;
  label?: string;
  size?: "sm" | "md";
};

function buildConfirmMessage(group: PipelineSnapshotGroup): string {
  const ref =
    group.requestRef.trim() && group.requestRef.trim() !== "—"
      ? group.requestRef.trim()
      : "this request";
  const lineWord =
    group.rows.length === 1 ? "1 product line" : `${group.rows.length} product lines`;
  return [
    `Are you sure you want to delete the entire procurement request "${ref}" for ${group.clientName}?`,
    "",
    `This permanently removes ${lineWord} from Trade & Transit, transit summary, and the CRM customer link.`,
    "This cannot be undone.",
  ].join("\n");
}

export function DeletePipelineRequestButton({
  group,
  onDeleted,
  className = "",
  label = "Delete request",
  size = "sm",
}: DeletePipelineRequestButtonProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (group.rows.length === 0) return;
    if (!window.confirm(buildConfirmMessage(group))) return;

    setDeleting(true);
    try {
      const deletedIds = group.rows.map((row) => row.id);
      const count = await deleteImportPipelineShipments(group.rows);
      notifyPipelineDeleted({
        count,
        clientName: group.clientName,
        requestRef: group.requestRef,
        shipmentIds: deletedIds,
      });
      onDeleted?.(deletedIds);
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Could not delete this procurement request. Try again.";
      window.alert(message);
    } finally {
      setDeleting(false);
    }
  }

  const sizeClass =
    size === "md" ? "px-3 py-2 text-sm" : "px-2.5 py-1 text-[11px]";

  return (
    <button
      type="button"
      disabled={deleting || group.rows.length === 0}
      onClick={() => void handleDelete()}
      className={`inline-flex items-center gap-1 rounded-md border border-rose-500/35 bg-rose-500/10 font-semibold text-rose-200 hover:bg-rose-500/20 transition disabled:opacity-50 ${sizeClass} ${className}`}
      title="Delete entire saved procurement request"
    >
      {deleting ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Trash2 className="h-3 w-3" />
      )}
      {label}
    </button>
  );
}
