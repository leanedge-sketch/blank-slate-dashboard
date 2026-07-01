import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  UserRound,
  Building2,
  Package,
} from "lucide-react";
import {
  searchCompanyAndContact,
  type CompanyContactSearchResult,
} from "../../services/companyContactSearch";
import type { Customer } from "../../services/api";
import type { ImportShipmentRow } from "../../services/importFinance";

type CompanyContactSearchPanelProps = {
  variant?: "dark" | "light";
  initialCompany?: string;
  initialContact?: string;
  onUseCrmCustomer?: (customer: Customer) => void;
  onUseShipment?: (shipment: ImportShipmentRow) => void;
  /** Called after a successful search (for filtering lists). */
  onSearchComplete?: (company: string, contact: string) => void;
  className?: string;
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = value.slice(0, 10);
  return d || "—";
}

export function CompanyContactSearchPanel({
  variant = "dark",
  initialCompany = "",
  initialContact = "",
  onUseCrmCustomer,
  onUseShipment,
  onSearchComplete,
  className = "",
}: CompanyContactSearchPanelProps) {
  const [company, setCompany] = useState(initialCompany);
  const [contact, setContact] = useState(initialContact);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanyContactSearchResult | null>(null);
  const [searched, setSearched] = useState(false);

  const isDark = variant === "dark";

  const inputClass = isDark
    ? "w-full rounded-lg border border-slate-800 bg-[#0B1120] px-3.5 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/40"
    : "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70";

  const labelClass = isDark
    ? "block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
    : "block text-sm font-medium text-slate-700 mb-1";

  const cardClass = isDark
    ? "rounded-xl border border-slate-800 bg-[#0B1120]/60 p-4"
    : "rounded-lg border border-slate-200 bg-slate-50 p-4";

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!company.trim() && !contact.trim()) {
      setError("Enter a company name and/or contact person to search.");
      setResult(null);
      setSearched(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await searchCompanyAndContact(company, contact);
      setResult(data);
      setSearched(true);
      onSearchComplete?.(company, contact);
    } catch (err: unknown) {
      setError(
        String((err as { message?: string })?.message ?? "Search failed. Try again."),
      );
      setResult(null);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <h3
          className={
            isDark
              ? "text-sm font-bold uppercase tracking-[0.15em] text-slate-300"
              : "text-base font-semibold text-slate-900"
          }
        >
          Search existing records
        </h3>
        <p className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}>
          Check CRM and Trade &amp; Transit before adding — search by company name and contact person.
        </p>
      </div>

      <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            <Building2 className="inline h-3.5 w-3.5 mr-1 opacity-70" />
            Company name
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Sika Abyssinia"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            <UserRound className="inline h-3.5 w-3.5 mr-1 opacity-70" />
            Contact person
          </label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="e.g. John Doe"
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className={
              isDark
                ? "inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
                : "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="flex items-center gap-2 text-sm text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {searched && result && !result.hasMatches ? (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 ${
            isDark
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Not found — likely safe to add</p>
            <p className="text-xs mt-1 opacity-90">
              No CRM customer or saved Trade &amp; Transit request matches this company and contact.
            </p>
          </div>
        </div>
      ) : null}

      {searched && result?.hasMatches ? (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 ${
            isDark
              ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Already on record</p>
            <p className="text-xs mt-1 opacity-90">
              Matching entries exist below. Review before creating a duplicate.
            </p>
          </div>
        </div>
      ) : null}

      {result && result.crmMatches.length > 0 ? (
        <section className={cardClass}>
          <h4
            className={`text-xs font-bold uppercase tracking-wider mb-3 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            CRM customers ({result.crmMatches.length})
          </h4>
          <ul className="space-y-2">
            {result.crmMatches.map((c) => (
              <li
                key={c.customer_id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                  isDark
                    ? "border-slate-700 bg-slate-900/50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <p className={isDark ? "text-white font-medium" : "text-slate-900 font-medium"}>
                    {c.customer_name}
                    {c.display_id ? (
                      <span className={isDark ? " text-slate-500" : " text-slate-500"}>
                        {" "}
                        ({c.display_id})
                      </span>
                    ) : null}
                  </p>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-600"}`}>
                    Contact: {c.primary_contact_name?.trim() || "—"}
                    {c.primary_contact_phone ? ` · ${c.primary_contact_phone}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/crm/customers/${c.customer_id}`}
                    className={
                      isDark
                        ? "text-xs text-cyan-400 hover:text-cyan-300"
                        : "text-xs text-blue-600 hover:text-blue-700"
                    }
                  >
                    View CRM
                  </Link>
                  {onUseCrmCustomer ? (
                    <button
                      type="button"
                      onClick={() => onUseCrmCustomer(c)}
                      className={
                        isDark
                          ? "text-xs rounded-md border border-teal-500/40 px-2 py-1 text-teal-300 hover:bg-teal-500/10"
                          : "text-xs rounded-md border border-blue-300 px-2 py-1 text-blue-700 hover:bg-blue-50"
                      }
                    >
                      Use this customer
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result && result.shipmentMatches.length > 0 ? (
        <section className={cardClass}>
          <h4
            className={`text-xs font-bold uppercase tracking-wider mb-3 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            <Package className="inline h-3.5 w-3.5 mr-1" />
            Trade &amp; Transit requests ({result.shipmentMatches.length})
          </h4>
          <ul className="space-y-2 max-h-56 overflow-y-auto">
            {result.shipmentMatches.map((s) => (
              <li
                key={s.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  isDark
                    ? "border-slate-700 bg-slate-900/50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className={isDark ? "text-white font-medium" : "text-slate-900 font-medium"}>
                  {s.client_name?.trim() || "—"}
                </p>
                <p className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-600"}`}>
                  Contact: {s.contact_person?.trim() || "—"}
                  {s.request_ref ? ` · Ref: ${s.request_ref}` : ""}
                  {s.request_date ? ` · ${formatDate(s.request_date)}` : ""}
                </p>
                {onUseShipment ? (
                  <button
                    type="button"
                    onClick={() => onUseShipment(s)}
                    className={
                      isDark
                        ? "mt-2 text-xs rounded-md border border-teal-500/40 px-2 py-1 text-teal-300 hover:bg-teal-500/10"
                        : "mt-2 text-xs rounded-md border border-blue-300 px-2 py-1 text-blue-700 hover:bg-blue-50"
                    }
                  >
                    Use this request
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
