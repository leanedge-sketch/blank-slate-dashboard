import { ArrowLeftRight } from "lucide-react";
import { listAllCurrencies } from "./currencyStore";
import { formatAmount, formatExchangeRateLabel } from "./utils";
import { CurrencySelect } from "./CurrencySelect";

export type CurrencyConverterWidgetProps = {
  fromCurrency: string;
  toCurrency: string;
  /** Amount in `fromCurrency` to convert for display. */
  amount?: number;
  rate: number | null;
  onRateChange: (rate: number | null) => void;
  onFromCurrencyChange?: (currency: string) => void;
  onToCurrencyChange?: (currency: string) => void;
  className?: string;
  compact?: boolean;
};

export function CurrencyConverterWidget({
  fromCurrency,
  toCurrency,
  amount = 0,
  rate,
  onRateChange,
  onFromCurrencyChange,
  onToCurrencyChange,
  className = "",
  compact = false,
}: CurrencyConverterWidgetProps) {
  const currencyOptions = listAllCurrencies([fromCurrency, toCurrency]);
  const converted =
    rate != null && rate > 0 && amount > 0 ? amount * rate : null;

  function handleSwap() {
    if (onFromCurrencyChange && onToCurrencyChange) {
      onFromCurrencyChange(toCurrency);
      onToCurrencyChange(fromCurrency);
    }
    if (rate != null && rate > 0) {
      onRateChange(Number((1 / rate).toFixed(6)));
    }
  }

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50 ${compact ? "p-2.5" : "p-3"} ${className}`}
    >
      <p className="mb-2 text-[11px] font-medium text-slate-600">
        Conversion rate (1 unit of “From” equals rate × “To”)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <CurrencySelect
          label="From"
          value={fromCurrency}
          onChange={(c) => onFromCurrencyChange?.(c)}
          extraOptions={currencyOptions}
        />

        <button
          type="button"
          onClick={handleSwap}
          title="Swap from / to"
          className="mx-auto rounded-md border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 sm:mb-0.5"
          aria-label="Swap conversion direction"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>

        <CurrencySelect
          label="To"
          value={toCurrency}
          onChange={(c) => onToCurrencyChange?.(c)}
          extraOptions={currencyOptions}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
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
            className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
            aria-label={`Exchange rate: 1 ${fromCurrency} equals`}
          />
        </div>
        <div className="min-w-0 flex-1 text-xs text-slate-600">
          {rate != null && rate > 0
            ? formatExchangeRateLabel(fromCurrency, toCurrency, rate)
            : "Enter a rate to calculate conversion"}
          {converted != null ? (
            <p className="mt-1 tabular-nums font-medium text-slate-800">
              {formatAmount(amount)} {fromCurrency} ≈{" "}
              <span className="text-emerald-700">
                {formatAmount(converted)} {toCurrency}
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
