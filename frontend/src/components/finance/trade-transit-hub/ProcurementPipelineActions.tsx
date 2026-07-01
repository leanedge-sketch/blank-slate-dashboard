import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { buildNewPipelinePath } from "../../../utils/pipelineEditPaths";
import { WorkbookImportActions } from "./WorkbookImportActions";

type ProcurementPipelineActionsProps = {
  /** hero = hub CTA row; compact = workspace header; launcher = product costing row */
  layout?: "hero" | "compact" | "launcher";
  className?: string;
  /** Where to open after workbook pick (default: new procurement pipeline). */
  workbookNavigateTo?: string;
};

const addLinkClass = {
  hero:
    "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/20 transition shrink-0 whitespace-nowrap group",
  compact:
    "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/20 transition shrink-0 whitespace-nowrap",
  launcher:
    "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/20 transition shrink-0 whitespace-nowrap",
} as const;

export function ProcurementPipelineActions({
  layout = "compact",
  className = "",
  workbookNavigateTo,
}: ProcurementPipelineActionsProps) {
  const newPipelineHref = buildNewPipelinePath();
  const addLabel = layout === "launcher" ? "Add procurement request" : "Add procurement pipeline";

  const workbook = (
    <WorkbookImportActions
      variant="secondary"
      layout="compact"
      navigateTo={workbookNavigateTo}
      className="shrink-0"
    />
  );

  const addLink = (
    <Link to={newPipelineHref} className={addLinkClass[layout === "launcher" ? "launcher" : layout === "hero" ? "hero" : "compact"]}>
      <Plus className="h-4 w-4" />
      {addLabel}
      {layout === "hero" ? (
        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
      ) : null}
    </Link>
  );

  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-3 ${className}`}
    >
      {workbook}
      {addLink}
    </div>
  );
}
