import { WorkbookPasteButton } from "./WorkbookPasteButton";
import { WorkbookUploadButton } from "./WorkbookUploadButton";

type WorkbookImportActionsProps = {
  variant?: "hero" | "secondary" | "inline";
  layout?: "hero" | "compact" | "launcher";
  className?: string;
  navigateTo?: string;
  /** Show a small label above the buttons (calculator toolbar). */
  showLabel?: boolean;
  /** In-place handlers for the calculator workspace. Omit to stash + navigate. */
  onPaste?: (text: string) => void | Promise<void>;
  onCsvFile?: (file: File) => void | Promise<void>;
};

export function WorkbookImportActions({
  variant = "inline",
  layout = "compact",
  className = "",
  navigateTo,
  showLabel = false,
  onPaste,
  onCsvFile,
}: WorkbookImportActionsProps) {
  const resolvedVariant =
    variant === "inline" && layout === "launcher" ? "secondary" : variant;

  return (
    <div className={className}>
      {showLabel ? (
        <span className="mb-1.5 block text-xs font-medium text-slate-400">
          Import from Excel
        </span>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <WorkbookPasteButton
          variant={resolvedVariant}
          layout={layout}
          navigateTo={navigateTo}
          onPaste={onPaste}
        />
        <WorkbookUploadButton
          variant={resolvedVariant}
          layout={layout}
          navigateTo={navigateTo}
          onCsvFile={onCsvFile}
        />
      </div>
    </div>
  );
}
