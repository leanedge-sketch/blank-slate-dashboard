import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { addCustomCurrency, listAllCurrencies } from "./currencyStore";

type CurrencySelectProps = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  extraOptions?: string[];
  className?: string;
  id?: string;
};

export function CurrencySelect({
  value,
  onChange,
  label,
  extraOptions = [],
  className = "",
  id,
}: CurrencySelectProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () => listAllCurrencies([value, ...extraOptions]),
    [value, extraOptions],
  );

  function submitNewCurrency() {
    const code = addCustomCurrency(draft);
    if (!code) {
      setError("Use a 3–4 letter code (e.g. UGX)");
      return;
    }
    setError(null);
    onChange(code);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-xs text-slate-600">
          {label}
        </label>
      ) : null}
      <div className="flex gap-1.5">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setError(null);
          }}
          title="Add currency"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-600 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {adding ? (
        <div className="mt-2 flex gap-1.5">
          <input
            type="text"
            maxLength={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            placeholder="New code"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs uppercase"
          />
          <button
            type="button"
            onClick={submitNewCurrency}
            className="rounded-md bg-orange-600 px-2 py-1.5 text-xs font-medium text-white"
          >
            Add
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
