import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadPricingRecords, type PricingRecord } from "../pms/pricing-costing/pricingApi";
import { formatAmount } from "../pms/pricing-costing/utils";

export type PipelinePricingSelection = {
  recordId: string;
  unitPrice: number;
  currency: string;
  validFrom: string;
};

type PipelinePricingSelectProps = {
  customerId?: string | null;
  productId?: string | null;
  value?: string | null;
  onChange: (selection: PipelinePricingSelection | null) => void;
  disabled?: boolean;
};

function formatOptionLabel(row: PricingRecord): string {
  const date = row.validFrom || "—";
  const status = row.status === "active" ? "Active" : "Historical";
  return `${formatAmount(row.priceAmount)} ${row.priceCurrency} · ${date} · ${status}`;
}

function comparePricingRecords(a: PricingRecord, b: PricingRecord): number {
  if (a.status === "active" && b.status !== "active") return -1;
  if (b.status === "active" && a.status !== "active") return 1;
  const av = a.validFrom ?? "";
  const bv = b.validFrom ?? "";
  return bv.localeCompare(av);
}

export function PipelinePricingSelect({
  customerId,
  productId,
  value,
  onChange,
  disabled,
}: PipelinePricingSelectProps) {
  const [rows, setRows] = useState<PricingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    autoSelectedRef.current = false;
    if (!customerId || !productId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadPricingRecords({
      crmPartnerId: customerId,
      pmsProductId: productId,
      limit: 10,
    })
      .then((records) => {
        if (cancelled) return;
        const sorted = [...records].sort(comparePricingRecords);
        setRows(sorted.slice(0, 10));
        const active = sorted.find((r) => r.status === "active") ?? sorted[0];
        const selectedValue = value?.trim() || "";
        if (active && !selectedValue && !autoSelectedRef.current) {
          autoSelectedRef.current = true;
          onChange({
            recordId: active.id,
            unitPrice: active.priceAmount,
            currency: active.priceCurrency,
            validFrom: active.validFrom ?? "",
          });
        }
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, productId]);

  function handleSelect(recordId: string) {
    const row = rows.find((r) => r.id === recordId);
    if (!row) {
      onChange(null);
      return;
    }
    onChange({
      recordId: row.id,
      unitPrice: row.priceAmount,
      currency: row.priceCurrency,
      validFrom: row.validFrom ?? "",
    });
  }

  if (!customerId || !productId) return null;

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Pricing from PMS
        <span className="ml-1 text-xs font-normal text-slate-400">
          Latest active by default · last 10 versions
        </span>
      </label>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pricing history…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-1">
          No pricing rows for this buyer and product in Pricing &amp; Costing yet.
        </p>
      ) : (
        <select
          value={value ?? rows[0]?.id ?? ""}
          disabled={disabled}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {formatOptionLabel(row)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
