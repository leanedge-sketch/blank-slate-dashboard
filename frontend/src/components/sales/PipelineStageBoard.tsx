import { useState } from "react";
import type { PipelineStage, SalesPipeline } from "../../services/api";

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

const PREVIEW_COUNT = 6;

type PipelineStageBoardProps = {
  pipelines: SalesPipeline[];
  getCustomerName: (customerId: string) => string;
  getProductName: (pipeline: SalesPipeline) => string;
  onSelect: (pipelineId: string) => void;
};

export function PipelineStageBoard({
  pipelines,
  getCustomerName,
  getProductName,
  onSelect,
}: PipelineStageBoardProps) {
  const [expandedStages, setExpandedStages] = useState<Set<PipelineStage>>(
    new Set(),
  );

  if (pipelines.length === 0) return null;

  function toggleStage(stage: PipelineStage) {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Pipeline by stage</h2>
        <p className="text-sm text-slate-500 mt-1">
          Kanban overview — click a deal to open details. Columns show up to{" "}
          {PREVIEW_COUNT} deals unless expanded.
        </p>
      </div>
      <div className="overflow-x-auto p-4 sm:p-6">
        <div className="flex gap-4 min-w-max">
          {BOARD_STAGES.map((stage) => {
            const stageDeals = pipelines.filter((p) => p.stage === stage);
            const expanded = expandedStages.has(stage);
            const visible = expanded
              ? stageDeals
              : stageDeals.slice(0, PREVIEW_COUNT);
            const hidden = stageDeals.length - visible.length;

            return (
              <div
                key={stage}
                className="w-56 flex-shrink-0 rounded-xl border border-slate-200 bg-slate-50/80"
              >
                <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STAGE_COLORS[stage]}`}
                  >
                    {stage}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {stageDeals.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 max-h-80 overflow-y-auto">
                  {stageDeals.length === 0 ? (
                    <p className="text-xs text-slate-400 px-2 py-4 text-center">—</p>
                  ) : (
                    <>
                      {visible.map((pipeline) => (
                        <button
                          key={pipeline.id}
                          type="button"
                          onClick={() => onSelect(pipeline.id)}
                          className="w-full text-left rounded-lg border border-slate-200 bg-white p-2.5 hover:border-emerald-400 hover:shadow-sm transition-all"
                        >
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {getCustomerName(pipeline.customer_id || "")}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {getProductName(pipeline)}
                          </p>
                        </button>
                      ))}
                      {hidden > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleStage(stage)}
                          className="w-full text-center text-xs font-semibold text-emerald-700 hover:text-emerald-900 py-2"
                        >
                          Show {hidden} more
                        </button>
                      ) : expanded && stageDeals.length > PREVIEW_COUNT ? (
                        <button
                          type="button"
                          onClick={() => toggleStage(stage)}
                          className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700 py-2"
                        >
                          Show less
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
