import { useMemo, useState } from "react";
import Papa from "papaparse";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { api } from "../../services/api";
import type {
  CRMPartner,
  PMSProduct,
  PricingLocation,
  PricingRecordInput,
} from "./pricing-costing/types";

export const CANONICAL_COLUMNS = [
  { key: "chemical_master_id", label: "chemical_master_id" },
  { key: "base_cost_usd", label: "base_cost_usd" },
  { key: "incoterm", label: "incoterm" },
  { key: "location", label: "location" },
  { key: "currency", label: "currency" },
] as const;

export type CanonicalColumn = (typeof CANONICAL_COLUMNS)[number]["key"];

type CSVUploaderProps = {
  partner: CRMPartner | null;
  pmsProducts: PMSProduct[];
  locations: PricingLocation[];
  defaultLocationId?: string;
  onImport: (rows: PricingRecordInput[]) => Promise<void>;
};

export function CSVUploader({
  partner,
  pmsProducts,
  locations,
  defaultLocationId,
  onImport,
}: CSVUploaderProps) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, CanonicalColumn | "">>({});
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  function reset() {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setError(null);
    setSummary(null);
    setPredicting(false);
  }

  async function parseFile(file: File) {
    setError(null);
    setSummary(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = (result.meta.fields ?? []).filter(Boolean);
        if (!cols.length) {
          setError("No CSV headers found.");
          return;
        }
        const parsed = (result.data ?? []).map((row) => {
          const next: Record<string, string> = {};
          for (const col of cols) next[col] = String(row[col] ?? "").trim();
          return next;
        });
        setHeaders(cols);
        setRows(parsed);
        setMapping(Object.fromEntries(cols.map((h) => [h, ""] as const)));
        setOpen(true);
        void predictMapping(cols, parsed.slice(0, 3));
      },
      error: (err) => {
        setError(err.message || "Could not parse CSV.");
      },
    });
  }

  async function predictMapping(cols: string[], sampleRows: Record<string, string>[]) {
    setPredicting(true);
    try {
      const res = await api.post<{ mapping: Record<string, string | null> }>(
        "/pms/predict-csv-mapping",
        { headers: cols, sample_rows: sampleRows },
      );
      const suggested = res.data.mapping || {};
      setMapping((prev) => {
        const next = { ...prev };
        for (const header of cols) {
          const value = suggested[header];
          if (value && CANONICAL_COLUMNS.some((c) => c.key === value)) {
            next[header] = value as CanonicalColumn;
          }
        }
        return next;
      });
    } catch {
      // Mapping stays empty; the user maps columns manually.
    } finally {
      setPredicting(false);
    }
  }

  const preview = useMemo(() => rows.slice(0, 8), [rows]);

  function columnFor(canonical: CanonicalColumn): string | "" {
    const found = headers.find((h) => mapping[h] === canonical);
    return found ?? "";
  }

  async function handleImport() {
    if (!partner) {
      setError("Select a partner first.");
      return;
    }
    const productCol = columnFor("chemical_master_id");
    const costCol = columnFor("base_cost_usd");
    if (!productCol || !costCol) {
      setError("Map chemical_master_id and base_cost_usd before importing.");
      return;
    }
    const fallbackLocation = defaultLocationId || locations[0]?.id || "";
    if (!fallbackLocation) {
      setError("Add a pricing location before importing.");
      return;
    }

    const incotermCol = columnFor("incoterm");
    const locationCol = columnFor("location");
    const currencyCol = columnFor("currency");

    const inputs: PricingRecordInput[] = [];
    let skipped = 0;
    for (const row of rows) {
      const productRaw = row[productCol] || "";
      const needle = productRaw.toLowerCase();
      const product = pmsProducts.find(
        (p) =>
          p.id === productRaw ||
          p.sku.toLowerCase() === needle ||
          p.name.toLowerCase() === needle ||
          p.name.toLowerCase().includes(needle),
      );
      if (!product) {
        skipped += 1;
        continue;
      }
      const country = locationCol ? row[locationCol] : "";
      const location =
        locations.find(
          (loc) =>
            loc.country.toLowerCase() === country.toLowerCase() ||
            (loc.city && loc.city.toLowerCase() === country.toLowerCase()),
        )?.id ?? fallbackLocation;
      const costAmount = Number(row[costCol] || 0);
      if (!Number.isFinite(costAmount)) {
        skipped += 1;
        continue;
      }
      const currency = (currencyCol ? row[currencyCol] : "USD") || "USD";
      inputs.push({
        crmPartnerId: partner.id,
        supplierPartnerId: partner.partnerKind === "pms" ? partner.id : null,
        partnerKind: partner.partnerKind,
        pmsProductId: product.id,
        incoterm: (incotermCol ? row[incotermCol] : "FOB") || "FOB",
        locationId: location,
        costCurrency: currency,
        costAmount,
        priceCurrency: currency,
        priceAmount: costAmount,
        needsCurrencyConversion: false,
        exchangeRateUsed: null,
        baseCurrency: null,
      });
    }

    if (!inputs.length) {
      setError(`No rows could be matched to catalog products (${skipped} skipped).`);
      return;
    }

    try {
      setImporting(true);
      await onImport(inputs);
      setSummary(`Imported ${inputs.length} row(s). Skipped ${skipped}.`);
      setRows([]);
      setHeaders([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <label
        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
          dragOver ? "border-orange-400 bg-orange-50 text-orange-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void parseFile(file);
        }}
      >
        <Upload className="h-4 w-4" />
        Upload CSV
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void parseFile(file);
          }}
        />
      </label>

      {open && headers.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <FileSpreadsheet className="h-4 w-4 text-orange-600" />
                  Map vendor columns
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  AI may pre-select columns. Review every mapping, then click Confirm Mapping & Import.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {predicting ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  AI is predicting column mappings...
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {headers.map((header) => (
                  <label key={header} className="block text-xs font-medium text-slate-700">
                    {header}
                    <select
                      value={mapping[header] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [header]: (e.target.value || "") as CanonicalColumn | "",
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— skip —</option>
                      {CANONICAL_COLUMNS.map((col) => (
                        <option key={col.key} value={col.key}>
                          {col.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      {headers.slice(0, 8).map((h) => (
                        <th key={h} className="px-2 py-1.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {headers.slice(0, 8).map((h) => (
                          <td key={h} className="max-w-[10rem] truncate px-2 py-1 text-slate-700">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
              {summary ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {summary}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importing || predicting}
                onClick={() => void handleImport()}
                className="rounded-full bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {importing ? "Importing…" : "Confirm Mapping & Import"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
