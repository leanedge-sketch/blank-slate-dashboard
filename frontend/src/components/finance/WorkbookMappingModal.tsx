import { useMemo, useState } from "react";
import Papa from "papaparse";

type RequiredFieldKey =
  | "product"
  | "baseCostUsd"
  | "quantityKg"
  | "freightUsdPerMt"
  | "dutyPct";

type RequiredField = {
  key: RequiredFieldKey;
  label: string;
  numeric: boolean;
};

const REQUIRED_FIELDS: RequiredField[] = [
  { key: "product", label: "Product Name / Formula", numeric: false },
  { key: "baseCostUsd", label: "Base Cost (USD)", numeric: true },
  { key: "quantityKg", label: "Quantity", numeric: true },
  { key: "freightUsdPerMt", label: "Freight Rate (USD/MT)", numeric: true },
  { key: "dutyPct", label: "Duty / Tariff %", numeric: true },
];

export type WorkbookColumnMapping = Record<RequiredFieldKey, string | null>;

function cleanNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Allow commas and common numeric formatting.
  const normalized = s.replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidNumericColumn(
  rows: Array<Record<string, string>>,
  columnKey: string,
): boolean {
  const values: string[] = rows
    .map((r) => (r[columnKey] ?? "").trim())
    .filter((v) => v.length > 0);

  if (values.length === 0) return false;

  const sample = values.slice(0, 30);
  const numericCount = sample.reduce((acc, v) => {
    return acc + (cleanNumber(v) != null ? 1 : 0);
  }, 0);

  // Deterministic rule: column must be parseable for most sampled non-empty cells.
  return numericCount / sample.length >= 0.9;
}

type WorkbookMappingModalProps = {
  rawText: string;
  onConfirmed: (mapping: WorkbookColumnMapping) => void;
};

export function WorkbookMappingModal({
  rawText,
  onConfirmed,
}: WorkbookMappingModalProps) {
  const parsed = useMemo(() => {
    const result = Papa.parse<Record<string, string>>(rawText, {
      header: true,
      skipEmptyLines: true,
    });
    const fields = (result.meta.fields ?? []).map(String);
    const rows = (result.data ?? []).map((r) => r as Record<string, string>);
    return { fields, rows };
  }, [rawText]);

  const headerOptions = parsed.fields;

  const [mapping, setMapping] = useState<WorkbookColumnMapping>(() => ({
    product: null,
    baseCostUsd: null,
    quantityKg: null,
    freightUsdPerMt: null,
    dutyPct: null,
  }));

  const validation = useMemo(() => {
    const v: Record<RequiredFieldKey, boolean> = {
      product: Boolean(mapping.product && mapping.product.trim()),
      baseCostUsd: false,
      quantityKg: false,
      freightUsdPerMt: false,
      dutyPct: false,
    };

    if (mapping.baseCostUsd) {
      v.baseCostUsd = isValidNumericColumn(parsed.rows, mapping.baseCostUsd);
    }
    if (mapping.quantityKg) {
      v.quantityKg = isValidNumericColumn(parsed.rows, mapping.quantityKg);
    }
    if (mapping.freightUsdPerMt) {
      v.freightUsdPerMt = isValidNumericColumn(
        parsed.rows,
        mapping.freightUsdPerMt,
      );
    }
    if (mapping.dutyPct) {
      v.dutyPct = isValidNumericColumn(parsed.rows, mapping.dutyPct);
    }
    return v;
  }, [mapping, parsed.rows]);

  const canConfirm = REQUIRED_FIELDS.every((f) => validation[f.key]);

  function setField(key: RequiredFieldKey, columnKey: string) {
    setMapping((prev) => ({ ...prev, [key]: columnKey }));
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Workbook column mapping review
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Select which spreadsheet columns feed each required request field. Numeric
            columns are validated by parsing sample values.
          </p>
        </div>
        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
          Deterministic mapping
        </span>
      </div>

      {headerOptions.length === 0 ? (
        <p className="mt-3 text-xs text-amber-200">
          Could not detect CSV headers. Paste/upload must include a header row.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {REQUIRED_FIELDS.map((field) => (
            <div
              key={field.key}
              className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {field.label}
                </label>
                <span
                  className={`text-[11px] font-semibold ${
                    validation[field.key]
                      ? "text-emerald-300"
                      : field.numeric
                        ? "text-amber-300"
                        : "text-slate-400"
                  }`}
                >
                  {validation[field.key] ? "OK" : field.numeric ? "Needs numeric column" : "Select column"}
                </span>
              </div>

              <select
                value={mapping[field.key] ?? ""}
                onChange={(e) => setField(field.key, e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                <option value="">-- Select column --</option>
                {headerOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() =>
            onConfirmed({
              product: mapping.product,
              baseCostUsd: mapping.baseCostUsd,
              quantityKg: mapping.quantityKg,
              freightUsdPerMt: mapping.freightUsdPerMt,
              dutyPct: mapping.dutyPct,
            })
          }
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Confirm mapping
        </button>
      </div>
    </section>
  );
}

