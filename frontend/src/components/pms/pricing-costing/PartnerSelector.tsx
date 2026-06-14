import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { CRMPartner, PricingRecord } from "./types";
import { partnerTypeLabel } from "./utils";

type PartnerSelectorProps = {
  partners: CRMPartner[];
  pricingRecords: PricingRecord[];
  selectedPartnerId: string | null;
  onSelectPartner: (partnerId: string) => void;
};

export function PartnerSelector({
  partners,
  pricingRecords,
  selectedPartnerId,
  onSelectPartner,
}: PartnerSelectorProps) {
  const [query, setQuery] = useState("");

  const activeCountByPartner = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of pricingRecords) {
      if (record.status !== "active") continue;
      counts.set(record.crmPartnerId, (counts.get(record.crmPartnerId) ?? 0) + 1);
    }
    return counts;
  }, [pricingRecords]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q),
    );
  }, [partners, query]);

  const pmsProviderCount = useMemo(
    () => partners.filter((p) => p.partnerKind === "pms").length,
    [partners],
  );

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 lg:w-96">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 p-3 backdrop-blur-sm">
        <label htmlFor="partner-search" className="sr-only">
          Search partners and providers
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="partner-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search buyers & providers…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {filtered.length} counterparty{filtered.length === 1 ? "" : "ies"} · CRM buyers + PMS
          providers ({pmsProviderCount})
        </p>
        {pmsProviderCount === 0 && partners.length > 0 ? (
          <p className="mt-1 text-[11px] text-amber-700">
            No PMS providers yet — add suppliers on the Chemicals catalog or PMS → Partners.
          </p>
        ) : null}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
        {partners.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-slate-500">
            No CRM buyers or PMS providers yet. Add customers in CRM and suppliers on PMS
            Chemicals or Partners.
          </li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-slate-500">
            No partners match your search.
          </li>
        ) : (
          filtered.map((partner) => {
            const selected = partner.id === selectedPartnerId;
            const activeCount = activeCountByPartner.get(partner.id) ?? 0;
            return (
              <li key={partner.id}>
                <button
                  type="button"
                  onClick={() => onSelectPartner(partner.id)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                    selected
                      ? "border-orange-200 bg-white shadow-sm ring-1 ring-orange-200 border-l-4 border-l-orange-500"
                      : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{partner.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {partnerTypeLabel(partner.type)} · {partner.partnerKind.toUpperCase()}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {activeCount} active price{activeCount === 1 ? "" : "s"}
                  </p>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
