import { useEffect, useState } from "react";
import {
  createBusinessUnit,
  fetchBusinessUnits,
  mergeBusinessUnitOptions,
} from "../../services/api";
import { formatApiErrorDetail } from "../../utils/apiErrors";

const ADD_VALUE = "__add_new_business_unit__";

export function BusinessUnitSelect({
  value,
  onChange,
  required = false,
  id = "business_unit",
  className,
  label = "Business unit",
  labelClassName,
  helperText,
  requiredMark = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
  className?: string;
  label?: string;
  labelClassName?: string;
  helperText?: string;
  requiredMark?: boolean;
}) {
  const [units, setUnits] = useState<string[]>(() =>
    mergeBusinessUnitOptions([], value),
  );
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBusinessUnits()
      .then((list) => {
        if (!cancelled) setUnits(mergeBusinessUnitOptions(list, value));
      })
      .catch(() => {
        if (!cancelled) setUnits((prev) => mergeBusinessUnitOptions(prev, value));
      });
    return () => {
      cancelled = true;
    };
    // Load once on mount; current value is merged separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setUnits((prev) => mergeBusinessUnitOptions(prev, value));
  }, [value]);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Enter a business unit name.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const created = await createBusinessUnit(trimmed);
      setUnits(mergeBusinessUnitOptions(created.business_units, created.name));
      onChange(created.name);
      setAdding(false);
      setNewName("");
    } catch (err) {
      setError(formatApiErrorDetail(err, "Could not add business unit."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {label ? (
        <label htmlFor={id} className={labelClassName}>
          {label}
          {requiredMark ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}
      <select
        id={id}
        value={adding ? ADD_VALUE : value}
        onChange={(e) => {
          if (e.target.value === ADD_VALUE) {
            setAdding(true);
            setNewName("");
            setError(null);
            return;
          }
          setAdding(false);
          setError(null);
          onChange(e.target.value);
        }}
        className={className}
        required={required && !adding}
      >
        <option value="">Select business unit…</option>
        {units.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
        <option value={ADD_VALUE}>+ Add new business unit…</option>
      </select>
      {adding ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Synresins East Africa"
            className={className}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewName("");
                setError(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
      {helperText ? (
        <p className="text-xs text-slate-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}
