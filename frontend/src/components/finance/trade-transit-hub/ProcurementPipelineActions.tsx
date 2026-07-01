import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { buildNewPipelinePath } from "../../../utils/pipelineEditPaths";
import { WorkbookUploadButton } from "./WorkbookUploadButton";

type ProcurementPipelineActionsProps = {
  /** hero = hub CTA row; compact = workspace header; launcher = product costing row */
  layout?: "hero" | "compact" | "launcher";
  className?: string;
  /** Where to open after workbook pick (default: new procurement pipeline). */
  workbookNavigateTo?: string;
};

const addLinkClass = {
  hero:
    "inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold text-base sm:text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/30 hover:-translate-y-0.5 active:translate-y-0 group shrink-0 whitespace-nowrap",
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
    <WorkbookUploadButton
      variant={layout === "hero" ? "hero" : "secondary"}
      layout={layout === "launcher" ? "launcher" : layout === "hero" ? "hero" : "compact"}
      navigateTo={workbookNavigateTo}
      className="shrink-0 whitespace-nowrap"
    />
  );

  const addLink = (
    <Link to={newPipelineHref} className={addLinkClass[layout === "launcher" ? "launcher" : layout === "hero" ? "hero" : "compact"]}>
      <Plus className={layout === "hero" ? "w-5 h-5 mr-2" : "h-4 w-4"} />
      {addLabel}
      {layout === "hero" ? (
        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
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
