import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Loader2 } from "lucide-react";
import { fetchCustomers } from "../../services/api";
import {
  loadPricingRecords,
  mapCustomerToCRMPartner,
} from "../pms/pricing-costing/pricingApi";
import type { PricingRecord } from "../pms/pricing-costing/types";
import type { TradeParameters } from "../../types/tradeParameters";
import {
  applyPricingRecordToTradeTransitInputs,
  comparePricingRecordsForSelection,
  resolveCrmPartnerByClientName,
} from "../../utils/tradeTransitPricingBridge";
import type { TradeTransitInputs } from "../../utils/tradeTransitCalc";
import { formatAmount } from "../pms/pricing-costing/utils";

type TradeTransitPricingSelectProps = {
  clientName: string;
  chemicalTypeId: string | null;
  parameters: TradeParameters;
  onApply: (patch: Partial<TradeTransitInputs>, record: PricingRecord) => void;
  disabled?: boolean;
};

function formatRecordLabel(record: PricingRecord): string {
  const status = record.status === "active" ? "Active" : record.status;
  return `${formatAmount(record.costAmount)} ${record.costCurrency} → ${formatAmount(record.priceAmount)} ${record.priceCurrency} · ${record.validFrom} · ${status}`;
}

export function TradeTransitPricingSelect({
  clientName,
  chemicalTypeId,
  parameters,
  onApply,
  disabled,
}: TradeTransitPricingSelectProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<PricingRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [unmatchedClient, setUnmatchedClient] = useState(false);

  const selected = useMemo(
    () => records.find((row) => row.id === selectedId) ?? null,
    [records, selectedId],
  );

  useEffect(() => {
    if (!chemicalTypeId || !clientName.trim()) {
      setRecords([]);
      setSelectedId("");
      setPartnerName(null);
      setUnmatchedClient(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const customersRes = await fetchCustomers({ limit: 500 });
        const partners = (customersRes.customers ?? []).map(mapCustomerToCRMPartner);
        const partner = resolveCrmPartnerByClientName(partners, clientName);
        if (!partner) {
          if (!cancelled) {
            setRecords([]);
            setSelectedId("");
            setPartnerName(null);
            setUnmatchedClient(true);
          }
          return;
        }

        const rows = await loadPricingRecords({
          crmPartnerId: partner.id,
          pmsProductId: chemicalTypeId,
          limit: 10,
        });
        if (cancelled) return;

        const sorted = [...rows].sort(comparePricingRecordsForSelection);
        setRecords(sorted);
        setPartnerName(partner.name);
        setUnmatchedClient(false);
        const preferred =
          sorted.find((row) => row.status === "active") ?? sorted[0];
        setSelectedId(preferred?.id ?? "");
      } catch {
        if (!cancelled) {
          setRecords([]);
          setSelectedId("");
          setPartnerName(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientName, chemicalTypeId]);

  if (!chemicalTypeId) return null;

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 px-4 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-300/90">
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Pricing &amp; costing link
          </label>
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading PMS pricing…
            </div>
          ) : unmatchedClient ? (
            <p className="text-xs text-amber-300/90">
              Client &quot;{clientName.trim()}&quot; does not match a CRM buyer yet.
              Set the same name in Trade parameters or add the customer in CRM.
            </p>
          ) : records.length === 0 ? (
            <p className="text-xs text-slate-500">
              No pricing rows for {partnerName ?? "this buyer"} and this product.
              Save from Trade &amp; Transit to push landed cost into Pricing &amp; Costing.
            </p>
          ) : (
            <select
              value={selectedId}
              disabled={disabled}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            >
              {records.map((row) => (
                <option key={row.id} value={row.id}>
                  {formatRecordLabel(row)}
                </option>
              ))}
            </select>
          )}
        </div>

        {selected && !loading && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const patch = applyPricingRecordToTradeTransitInputs(
                selected,
                {
                  capitalParallelRate: parameters.exchangeRate,
                } as TradeTransitInputs,
                parameters,
              );
              onApply(patch, selected);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-2.5 text-sm font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-50 transition"
          >
            Apply PMS pricing
          </button>
        )}
      </div>
      {selected && (
        <p className="mt-2 text-[10px] text-slate-500">
          Buyer: {partnerName} · Incoterm {selected.incoterm} · pulls supplier cost and sell
          price into this calculator.
        </p>
      )}
    </div>
  );
}
