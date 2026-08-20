import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import type {
  CRMPartner,
  PMSProduct,
  PricingLocation,
  PricingRecordInput,
} from "./types";

export const CSV_TARGET_FIELDS = [
  { key: "product", label: "Product name / SKU" },
  { key: "incoterm", label: "Incoterm" },
  { key: "cost_amount", label: "Cost amount" },
  { key: "cost_currency", label: "Cost currency" },
  { key: "price_amount", label: "Price amount" },
  { key: "price_currency", label: "Price currency" },
  { key: "country", label: "Location / country" },
] as const;

export type CsvTargetKey = (typeof CSV_TARGET_FIELDS)[number]["key"];

const HEADER_ALIASES: Record<CsvTargetKey, string[]> = {
  product: ["product", "product_name", "sku", "item", "chemical", "grade"],
  incoterm: ["incoterm", "incoterms", "terms"],
  cost_amount: ["cost", "cost_amount", "unit_cost", "buy", "purchase"],
  cost_currency: ["cost_currency", "cost_ccy", "buy_currency"],
  price_amount: ["price", "price_amount", "sell", "selling", "unit_price"],
  price_currency: ["price_currency", "sell_currency", "ccy", "currency"],
  country: ["country", "location", "city", "port", "origin"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function guessMapping(headers: string[]): Record<CsvTargetKey, string> {
  const mapping = {} as Record<CsvTargetKey, string>;
  for (const field of CSV_TARGET_FIELDS) {
    const aliases = HEADER_ALIASES[field.key];
    const match = headers.find((h) => aliases.includes(normalizeHeader(h)));
    mapping[field.key] = match ?? "";
  }
  return mapping;
}

type PricingCsvMapperProps = {
  partner: CRMPartner | null;
  pmsProducts: PMSProduct[];
  locations: PricingLocation[];
  defaultLocationId?: string;
  onImport: (rows: PricingRecordInput[]) => Promise<void>;
};

export function PricingCsvMapper({
  partner,
  pmsProducts,
  locations,
  defaultLocationId,
  onImport,
}: PricingCsvMapperProps) {
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<CsvTargetKey, string>>(
    {} as Record<CsvTargetKey, string>,
  );
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  function reset() {
    setHeaders([]);
    setRows([]);
    setMapping({} as Record<CsvTargetKey, string>);
    setError(null);
    setSummary(null);
  }

  async function onFile(file: File) {
    setError(null);
    setSummary(null);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      setError("The file has no worksheets.");
      return;
    }
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
    if (!json.length) {
      setError("No data rows found.");
      return;
    }
    const cols = Object.keys(json[0] ?? {});
    setHeaders(cols);
    setRows(
      json.map((row) => {
        const next: Record<string, string> = {};
        for (const col of cols) next[col] = String(row[col] ?? "").trim();
        return next;
      }),
    );
    setMapping(guessMapping(cols));
    setOpen(true);
  }

  const preview = useMemo(() => rows.slice(0, 8), [rows]);

  async function handleImport() {
    if (!partner) {
      setError("Select a partner first.");
      return;
    }
    if (!mapping.product || !mapping.price_amount) {
      setError("Map at least Product and Price amount.");
      return;
    }
    const fallbackLocation =
      defaultLocationId || locations[0]?.id || "";
    if (!fallbackLocation) {
      setError("Add a pricing location before importing.");
      return;
    }

    const inputs: PricingRecordInput[] = [];
    let skipped = 0;
    for (const row of rows) {
      const productRaw = row[mapping.product] || "";
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
      const country = mapping.country ? row[mapping.country] : "";
      const location =
        locations.find(
          (loc) =>
            loc.country.toLowerCase() === country.toLowerCase() ||
            (loc.city && loc.city.toLowerCase() === country.toLowerCase()),
        )?.id ?? fallbackLocation;
      const costAmount = Number(mapping.cost_amount ? row[mapping.cost_amount] : 0);
      const priceAmount = Number(row[mapping.price_amount] || 0);
      if (!priceAmount && !costAmount) {
        skipped += 1;
        continue;
      }
      inputs.push({
        crmPartnerId: partner.id,
        supplierPartnerId: partner.partnerKind === "pms" ? partner.id : null,
        partnerKind: partner.partnerKind,
        pmsProductId: product.id,
        incoterm: (mapping.incoterm ? row[mapping.incoterm] : "FOB") || "FOB",
        locationId: location,
        costCurrency: (mapping.cost_currency ? row[mapping.cost_currency] : "USD") || "USD",
        costAmount: Number.isFinite(costAmount) ? costAmount : 0,
        priceCurrency:
          (mapping.price_currency ? row[mapping.price_currency] : "USD") || "USD",
        priceAmount: Number.isFinite(priceAmount) ? priceAmount : 0,
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
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Upload className="h-4 w-4" />
        Upload CSV
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFile(file);
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
                  Phase 1 is manual: match each LeanChem field to a spreadsheet header.
                  Unmapped columns are ignored.
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
              <div className="grid gap-3 sm:grid-cols-2">
                {CSV_TARGET_FIELDS.map((field) => (
                  <label key={field.key} className="block text-xs font-medium text-slate-700">
                    {field.label}
                    <select
                      value={mapping[field.key] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— skip —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
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
                disabled={importing}
                onClick={() => void handleImport()}
                className="rounded-full bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {importing ? "Importing…" : `Import ${rows.length} rows`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
