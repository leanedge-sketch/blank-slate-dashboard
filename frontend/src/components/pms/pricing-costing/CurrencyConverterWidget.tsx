import { ArrowLeftRight } from "lucide-react";
import { formatAmount, formatExchangeRateLabel } from "./utils";

export type CurrencyConverterWidgetProps = {
  fromCurrency: string;
  toCurrency: string;
  /** Amount in `fromCurrency` to convert for display. */
  amount?: number;
  rate: number | null;
  onRateChange: (rate: number | null) => void;
  /** When true, from/to currency fields are read-only. */
  currenciesReadOnly?: boolean;
  onFromCurrencyChange?: (currency: string) => void;
  onToCurrencyChange?: (currency: string) => void;
  currencyOptions?: string[];
  className?: string;
  compact?: boolean;
};

export function CurrencyConverterWidget({
  fromCurrency,
  toCurrency,
  amount = 0,
  rate,
  onRateChange,
  currenciesReadOnly = true,
  onFromCurrencyChange,
  onToCurrencyChange,
  currencyOptions = ["USD", "EUR", "ETB", "KES"],
  className = "",
  compact = false,
}: CurrencyConverterWidgetProps) {
  const converted =
    rate != null && rate > 0 && amount > 0 ? amount * rate : null;

  function handleSwap() {
    if (rate != null && rate > 0) {
      onRateChange(Number((1 / rate).toFixed(6)));
    }
    if (onFromCurrencyChange && onToCurrencyChange) {
      onFromCurrencyChange(toCurrency);
      onToCurrencyChange(fromCurrency);
    }
  }

  const canSwap =
    (rate != null && rate > 0) ||
    (onFromCurrencyChange != null && onToCurrencyChange != null);

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50 ${compact ? "p-2.5" : "p-3"} ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <label className="sr-only">From currency</label>
          {currenciesReadOnly ? (
            <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold uppercase text-slate-700">
              {fromCurrency}
            </span>
          ) : (
            <select
              value={fromCurrency}
              onChange={(e) => onFromCurrencyChange?.(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold uppercase text-slate-700"
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <span className="text-xs text-slate-400">→</span>

          <label className="sr-only">To currency</label>
          {currenciesReadOnly ? (
            <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold uppercase text-slate-700">
              {toCurrency}
            </span>
          ) : (
            <select
              value={toCurrency}
              onChange={(e) => onToCurrencyChange?.(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold uppercase text-slate-700"
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <label className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Rate
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              placeholder="0.00"
              value={rate ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onRateChange(v === "" ? null : Number(v));
              }}
              className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
              aria-label={`Exchange rate: 1 ${fromCurrency} equals`}
            />
          </div>

          <button
            type="button"
            onClick={handleSwap}
            disabled={!canSwap}
            title="Invert rate direction"
            className="mt-4 rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Swap conversion direction"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>
          {rate != null && rate > 0
            ? formatExchangeRateLabel(fromCurrency, toCurrency, rate)
            : "Enter rate to convert"}
        </span>
        {converted != null && (
          <span className="tabular-nums font-medium text-slate-800">
            {formatAmount(amount)} {fromCurrency} ≈{" "}
            <span className="text-emerald-700">
              {formatAmount(converted)} {toCurrency}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
