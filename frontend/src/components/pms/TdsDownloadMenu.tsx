import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, FileText, Loader2, Sparkles } from "lucide-react";

const MENU_WIDTH = 208;

type TdsDownloadMenuProps = {
  disabled?: boolean;
  busy?: boolean;
  originalAvailable: boolean;
  onDownloadOriginal: () => void;
  onDownloadBrief: () => void;
};

export function TdsDownloadMenu({
  disabled = false,
  busy = false,
  originalAvailable,
  onDownloadOriginal,
  onDownloadBrief,
}: TdsDownloadMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuStyle(null);
      return;
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(
        8,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      );
      setMenuStyle({ top: rect.bottom + 4, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        Download
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open &&
        menuStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: menuStyle.top,
              left: menuStyle.left,
              width: MENU_WIDTH,
              zIndex: 9999,
            }}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-xl shadow-slate-900/10"
          >
            <button
              type="button"
              role="menuitem"
              disabled={!originalAvailable}
              title={
                originalAvailable
                  ? "Download the uploaded TDS file"
                  : "No uploaded file for this record"
              }
              onClick={() => {
                setOpen(false);
                onDownloadOriginal();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
            >
              <FileText className="h-3.5 w-3.5" />
              Original PDF
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDownloadBrief();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Product brief
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
