import { useState } from "react";
import { Search } from "lucide-react";
import { CompanyContactSearchPanel } from "../../crm/CompanyContactSearchPanel";
import type { Customer } from "../../../services/api";
import type { ImportShipmentRow } from "../../../services/importFinance";

export type TransitSummarySearchFilter = {
  company: string;
  contact: string;
};

type TransitSummarySearchSectionProps = {
  initialCompany?: string;
  initialContact?: string;
  onFilterChange?: (filter: TransitSummarySearchFilter) => void;
  onUseShipment?: (shipment: ImportShipmentRow) => void;
  onUseCrmCustomer?: (customer: Customer) => void;
};

export function TransitSummarySearchSection({
  initialCompany = "",
  initialContact = "",
  onFilterChange,
  onUseShipment,
  onUseCrmCustomer,
}: TransitSummarySearchSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 sm:p-5 shadow-[0_0_24px_rgba(6,182,212,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-cyan-400" />
          <div>
            <p className="text-sm font-bold text-white">Search company and contact</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Check CRM and saved requests before adding a duplicate pipeline.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
        >
          {expanded ? "Hide search" : "Show search"}
        </button>
      </div>

      {expanded ? (
        <CompanyContactSearchPanel
          variant="dark"
          initialCompany={initialCompany}
          initialContact={initialContact}
          onSearchComplete={(company, contact) =>
            onFilterChange?.({ company, contact })
          }
          onUseCrmCustomer={onUseCrmCustomer}
          onUseShipment={(shipment) => {
            onFilterChange?.({
              company: shipment.client_name?.trim() ?? "",
              contact: shipment.contact_person?.trim() ?? "",
            });
            onUseShipment?.(shipment);
          }}
          className="border-t border-slate-800 pt-4"
        />
      ) : null}
    </section>
  );
}

/** Apply company + contact filter to saved pipeline request groups. */
export function pipelineGroupMatchesSearch(
  clientName: string,
  contactPerson: string,
  requestRef: string,
  filter: TransitSummarySearchFilter,
): boolean {
  const company = filter.company.trim().toLowerCase();
  const contact = filter.contact.trim().toLowerCase();
  if (!company && !contact) return true;

  const name = clientName.trim().toLowerCase();
  const person = contactPerson.trim().toLowerCase();
  const ref = requestRef.trim().toLowerCase();

  const companyMatch =
    !company || name.includes(company) || ref.includes(company);
  const contactMatch = !contact || person.includes(contact);

  return companyMatch && contactMatch;
}
