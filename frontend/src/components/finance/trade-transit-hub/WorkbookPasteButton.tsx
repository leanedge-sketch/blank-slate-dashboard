import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { TRADE_TRANSIT_ROUTES } from "../../../contexts/TradeTransitRequestContext";
import { stashWorkbookText } from "../../../utils/workbookUploadSession";

type WorkbookPasteButtonProps = {
  variant?: "hero" | "secondary" | "inline";
  layout?: "hero" | "compact" | "launcher";
  className?: string;
  navigateTo?: string;
  /** When set, paste is handled in-place instead of navigating away. */
  onPaste?: (text: string) => void | Promise<void>;
};

const variantClass: Record<NonNullable<WorkbookPasteButtonProps["variant"]>, string> = {
  hero:
    "inline-flex items-center justify-center px-8 py-4 rounded-xl border-2 border-cyan-500/40 bg-cyan-500/10 text-cyan-100 font-bold text-base sm:text-lg transition-all duration-300 hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:-translate-y-0.5 active:translate-y-0",
  secondary:
    "inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-400/50 transition",
  inline:
    "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-300 hover:border-cyan-500/30 hover:text-cyan-300 transition",
};

const layoutPadding: Record<NonNullable<WorkbookPasteButtonProps["layout"]>, string> = {
  hero: "",
  compact: "",
  launcher: "!py-3",
};

export function WorkbookPasteButton({
  variant = "inline",
  layout = "compact",
  className = "",
  navigateTo = `${TRADE_TRANSIT_ROUTES.newPipeline}?fresh=1`,
  onPaste,
}: WorkbookPasteButtonProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handlePaste() {
    setLoading(true);
    try {
      let text = "";
      try {
        text = await navigator.clipboard.readText();
      } catch {
        text = window.prompt(
          "Paste your Excel sheet here (select all cells in Excel, Ctrl+C, then paste):",
          "",
        ) ?? "";
      }

      if (!text.trim()) {
        window.alert(
          "Clipboard is empty. In Excel, select the sheet cells (Ctrl+A), copy (Ctrl+C), then try again.",
        );
        return;
      }

      if (onPaste) {
        await onPaste(text);
        return;
      }

      stashWorkbookText("Excel paste", text);
      navigate(navigateTo);
    } catch (err: unknown) {
      console.error(err);
      window.alert("Could not read clipboard. Paste manually when prompted.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handlePaste()}
      className={`${variantClass[variant]} ${layoutPadding[layout]} disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${variant === "hero" ? "mr-2" : ""}`} />
      ) : (
        <ClipboardPaste
          className={`shrink-0 ${variant === "hero" ? "w-5 h-5 mr-2" : "h-4 w-4"}`}
        />
      )}
      Paste from Excel
    </button>
  );
}
