import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { TRADE_TRANSIT_ROUTES } from "../../../contexts/TradeTransitRequestContext";
import { stashWorkbookForUpload } from "../../../utils/workbookUploadSession";

type WorkbookUploadButtonProps = {
  /** hero = hub CTA row, secondary = outline on dark UI, inline = compact toolbar */
  variant?: "hero" | "secondary" | "inline";
  /** Match sibling launcher buttons (product costing row). */
  layout?: "hero" | "compact" | "launcher";
  className?: string;
  /** Where to open the costing workspace after file pick (default: new procurement pipeline). */
  navigateTo?: string;
  /** When set, CSV is handled in-place instead of navigating away. */
  onCsvFile?: (file: File) => void | Promise<void>;
};

const variantClass: Record<NonNullable<WorkbookUploadButtonProps["variant"]>, string> = {
  hero:
    "inline-flex items-center justify-center px-8 py-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-100 font-bold text-base sm:text-lg transition-all duration-300 hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0",
  secondary:
    "inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-400/50 transition",
  inline:
    "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-300 hover:border-emerald-500/30 hover:text-emerald-300 transition",
};

const layoutPadding: Record<NonNullable<WorkbookUploadButtonProps["layout"]>, string> = {
  hero: "",
  compact: "",
  launcher: "!py-3",
};

export function WorkbookUploadButton({
  variant = "inline",
  layout = "compact",
  className = "",
  navigateTo = `${TRADE_TRANSIT_ROUTES.newPipeline}?fresh=1`,
  onCsvFile,
}: WorkbookUploadButtonProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    setLoading(true);
    try {
      if (onCsvFile) {
        await onCsvFile(file);
        return;
      }
      await stashWorkbookForUpload(file);
      navigate(navigateTo);
    } catch (err: unknown) {
      console.error(err);
      window.alert("Could not read the workbook file. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className={`${variantClass[variant]} ${layoutPadding[layout]} disabled:opacity-60 ${className}`}
      >
        {loading ? (
          <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${variant === "hero" ? "mr-2" : ""}`} />
        ) : (
          <FileSpreadsheet
            className={`shrink-0 ${variant === "hero" ? "w-5 h-5 mr-2" : "h-4 w-4"}`}
          />
        )}
        Upload CSV
      </button>
    </>
  );
}
