import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const t = day.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function formatShort(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type CalendarGridProps = {
  month: Date;
  start: Date | null;
  end: Date | null;
  onSelect: (iso: string) => void;
};

function CalendarGrid({ month, start, end, onSelect }: CalendarGridProps) {
  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const lead = first.getDay();
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const items: Array<{ iso: string; date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < lead; i += 1) {
      const date = new Date(first.getFullYear(), first.getMonth(), i - lead + 1);
      items.push({ iso: toIsoDate(date), date, inMonth: false });
    }
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(first.getFullYear(), first.getMonth(), day);
      items.push({ iso: toIsoDate(date), date, inMonth: true });
    }
    while (items.length % 7 !== 0) {
      const last = items[items.length - 1].date;
      const date = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      items.push({ iso: toIsoDate(date), date, inMonth: false });
    }
    return items;
  }, [month]);

  const today = new Date();

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const selectedStart = start ? sameDay(cell.date, start) : false;
          const selectedEnd = end ? sameDay(cell.date, end) : false;
          const selected = selectedStart || selectedEnd;
          const ranged = inRange(cell.date, start, end);
          const isToday = sameDay(cell.date, today);
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              className={`h-8 text-xs rounded-md transition ${
                selected
                  ? "bg-violet-600 text-white font-semibold"
                  : ranged
                    ? "bg-violet-500/20 text-violet-100"
                    : cell.inMonth
                      ? "text-slate-200 hover:bg-white/10"
                      : "text-slate-600 hover:bg-white/5"
              } ${isToday && !selected ? "ring-1 ring-violet-400/60" : ""}`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DateRangeCalendarDropdownProps = {
  startDate: string;
  endDate: string;
  onChange: (next: { startDate: string; endDate: string }) => void;
  onClear?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Month to show when no start date is selected. */
  anchorDate?: string;
};

export function DateRangeCalendarDropdown({
  startDate,
  endDate,
  onChange,
  onClear,
  open,
  onOpenChange,
  anchorDate,
}: DateRangeCalendarDropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const rootRef = useRef<HTMLDivElement>(null);
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(start ?? new Date()),
  );
  const [picking, setPicking] = useState<"start" | "end">(
    startDate && !endDate ? "end" : "start",
  );

  useEffect(() => {
    if (!isOpen) return;
    const focus =
      parseIsoDate(startDate) ??
      parseIsoDate((anchorDate ?? "").slice(0, 10)) ??
      new Date();
    setVisibleMonth(startOfMonth(focus));
    setPicking(startDate && !endDate ? "end" : "start");
    // Only re-anchor when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isOpen, setOpen]);

  function handleSelect(iso: string) {
    const picked = parseIsoDate(iso);
    if (!picked) return;

    if (picking === "start" || !startDate) {
      onChange({ startDate: iso, endDate: endDate && iso > endDate ? "" : endDate });
      setPicking("end");
      return;
    }

    if (start && picked < start) {
      onChange({ startDate: iso, endDate: startDate });
      setPicking("start");
      setOpen(false);
      return;
    }

    onChange({ startDate, endDate: iso });
    setPicking("start");
    setOpen(false);
  }

  const hasRange = Boolean(startDate || endDate);
  const label = hasRange
    ? `${formatShort(startDate || "start")} – ${formatShort(endDate || "now")}`
    : "Custom";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition ${
          hasRange || isOpen
            ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
            : "text-slate-400 hover:text-white"
        }`}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-[300px] rounded-xl border border-white/10 bg-slate-900 p-3 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
              className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-white">
              {visibleMonth.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </p>
            <button
              type="button"
              onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
              className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-2 text-[11px] text-slate-400">
            {picking === "start" ? "Select start date" : "Select end date"}
          </p>
          <CalendarGrid
            month={visibleMonth}
            start={start}
            end={end}
            onSelect={handleSelect}
          />
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
            <p className="text-[11px] text-slate-500">
              {hasRange ? label : "Click a start day, then an end day"}
            </p>
            {hasRange && onClear ? (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
