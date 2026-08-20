import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useState } from "react";
import type { PipelineStage, SalesPipeline } from "../../services/api";
import {
  StageChangeReasonModal,
  type PendingStageMove,
} from "./StageChangeReasonModal";

const STAGE_COLORS: Record<PipelineStage, string> = {
  "Lead ID": "bg-slate-100 text-slate-700 border-slate-300",
  Discovery: "bg-blue-100 text-blue-700 border-blue-300",
  Sample: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Validation: "bg-orange-100 text-orange-700 border-orange-300",
  Proposal: "bg-indigo-100 text-indigo-700 border-indigo-300",
  Confirmation: "bg-green-100 text-green-700 border-green-300",
  Closed: "bg-emerald-500 text-white border-emerald-600",
  Lost: "bg-red-500 text-white border-red-600",
};

const BOARD_STAGES: PipelineStage[] = [
  "Lead ID",
  "Discovery",
  "Sample",
  "Validation",
  "Proposal",
  "Confirmation",
  "Closed",
];

type PipelineStageBoardProps = {
  pipelines: SalesPipeline[];
  getCustomerName: (customerId: string) => string;
  getProductName: (pipeline: SalesPipeline) => string;
  onSelect: (pipelineId: string) => void;
  onStageChangeWithReason: (payload: {
    pipelineId: string;
    fromStage: PipelineStage;
    toStage: PipelineStage;
    reason: string;
    closeReason?: string;
  }) => Promise<void>;
};

export function PipelineStageBoard({
  pipelines,
  getCustomerName,
  getProductName,
  onSelect,
  onStageChangeWithReason,
}: PipelineStageBoardProps) {
  const [pending, setPending] = useState<PendingStageMove | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onDragEnd(result: DropResult) {
    const dest = result.destination;
    if (!dest) return;
    const fromStage = result.source.droppableId as PipelineStage;
    const toStage = dest.droppableId as PipelineStage;
    if (fromStage === toStage) return;
    const pipeline = pipelines.find((p) => p.id === result.draggableId);
    if (!pipeline) return;
    setError(null);
    setPending({
      pipelineId: pipeline.id,
      fromStage,
      toStage,
    });
  }

  async function confirmMove(reason: string, closeReason?: string) {
    if (!pending) return;
    try {
      setSaving(true);
      setError(null);
      await onStageChangeWithReason({
        ...pending,
        reason,
        closeReason,
      });
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update stage.");
    } finally {
      setSaving(false);
    }
  }

  if (pipelines.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Pipeline by stage</h2>
        <p className="mt-1 text-sm text-slate-500">
          Drag a deal to a new column. The card snaps back until you confirm a
          justification.
        </p>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="overflow-x-auto p-4 sm:p-6">
          <div className="flex min-w-max gap-4">
            {BOARD_STAGES.map((stage) => {
              const stageDeals = pipelines.filter((p) => p.stage === stage);
              return (
                <Droppable droppableId={stage} key={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`w-56 flex-shrink-0 rounded-xl border bg-slate-50/80 ${
                        snapshot.isDraggingOver
                          ? "border-emerald-400 bg-emerald-50/70"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STAGE_COLORS[stage]}`}
                        >
                          {stage}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {stageDeals.length}
                        </span>
                      </div>
                      <div className="max-h-80 space-y-2 overflow-y-auto p-2">
                        {stageDeals.map((pipeline, index) => (
                          <Draggable
                            key={pipeline.id}
                            draggableId={pipeline.id}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`rounded-lg border bg-white p-2.5 ${
                                  dragSnapshot.isDragging
                                    ? "border-emerald-400 shadow-md"
                                    : "border-slate-200"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => onSelect(pipeline.id)}
                                  className="w-full text-left"
                                >
                                  <p className="truncate text-xs font-semibold text-slate-900">
                                    {getCustomerName(pipeline.customer_id || "")}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-slate-500">
                                    {getProductName(pipeline)}
                                  </p>
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {stageDeals.length === 0 ? (
                          <p className="px-2 py-4 text-center text-xs text-slate-400">
                            Drop here
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </div>
      </DragDropContext>
      <StageChangeReasonModal
        pending={pending}
        saving={saving}
        error={error}
        onCancel={() => {
          if (!saving) {
            setPending(null);
            setError(null);
          }
        }}
        onConfirm={(reason, closeReason) => void confirmMove(reason, closeReason)}
      />
    </div>
  );
}
