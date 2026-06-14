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

function PartnerList({
  partners,
  selectedPartnerId,
  onSelectPartner,
  activeCountByPartner,
}: {
  partners: CRMPartner[];
  selectedPartnerId: string | null;
  onSelectPartner: (partnerId: string) => void;
  activeCountByPartner: Map<string, number>;
}) {
  if (partners.length === 0) {
    return (
      <li className="px-3 py-4 text-center text-xs text-slate-500">None yet</li>
    );
  }
  return (
    <>
      {partners.map((partner) => {
        const selected = partner.id === selectedPartnerId;
        const activeCount = activeCountByPartner.get(partner.id) ?? 0;
        return (
          <li key={`${partner.partnerKind}-${partner.id}`}>
            <button
              type="button"
              onClick={() => onSelectPartner(partner.id)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                selected
                  ? "border-orange-200 bg-white shadow-sm ring-1 ring-orange-200 border-l-4 border-l-orange-500"
                  : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{partner.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{partnerTypeLabel(partner.type)}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeCount} active price{activeCount === 1 ? "" : "s"}
              </p>
            </button>
          </li>
        );
      })}
    </>
  );
}

export function PartnerSelector({
  partners,
  pricingRecords,
  selectedPartnerId,
  onSelectPartner,
}: PartnerSelectorProps) {
  const [query, setQuery] = useState("");

  const buyers = useMemo(
    () => partners.filter((p) => p.partnerKind === "crm"),
    [partners],
  );
  const suppliers = useMemo(
    () => partners.filter((p) => p.partnerKind === "pms"),
    [partners],
  );

  const activeCountByPartner = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of pricingRecords) {
      if (record.status !== "active") continue;
      counts.set(record.crmPartnerId, (counts.get(record.crmPartnerId) ?? 0) + 1);
      if (record.supplierPartnerId) {
        counts.set(
          record.supplierPartnerId,
          (counts.get(record.supplierPartnerId) ?? 0) + 1,
        );
      }
    }
    return counts;
  }, [pricingRecords]);

  const filterList = (list: CRMPartner[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q),
    );
  };

  const filteredBuyers = filterList(buyers);
  const filteredSuppliers = filterList(suppliers);

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 lg:w-96">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 p-3 backdrop-blur-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search buyers or suppliers…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-4">
        <section>
          <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Buyers · CRM ({filteredBuyers.length})
          </h3>
          <ul className="space-y-1">
            <PartnerList
              partners={filteredBuyers}
              selectedPartnerId={selectedPartnerId}
              onSelectPartner={onSelectPartner}
              activeCountByPartner={activeCountByPartner}
            />
          </ul>
        </section>
        <section>
          <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Suppliers · PMS ({filteredSuppliers.length})
          </h3>
          <ul className="space-y-1">
            <PartnerList
              partners={filteredSuppliers}
              selectedPartnerId={selectedPartnerId}
              onSelectPartner={onSelectPartner}
              activeCountByPartner={activeCountByPartner}
            />
          </ul>
        </section>
      </div>
    </aside>
  );
}
