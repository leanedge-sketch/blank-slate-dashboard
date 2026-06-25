import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, UserRound } from "lucide-react";
import { fetchCustomers, type Customer } from "../../../services/api";
import {
  ensurePipelineRequestIds,
  generatePipelineRequestRef,
} from "../../../types/tradeParameters";
import type { TradeParameters } from "../../../types/tradeParameters";
import type { TradeTransitRequest } from "../../../utils/tradeTransitRequest";
import { openNewPipelineWindow } from "../../../utils/newPipelineSession";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40";

type TradeRequestContextBarProps = {
  parameters?: TradeParameters;
  request: TradeTransitRequest;
  productCount: number;
  readOnly?: boolean;
  showProcurementLineAction?: boolean;
  onSync: (patch: {
    customerId?: string;
    clientName?: string;
    contactPerson?: string;
    requestDate?: string;
    requestRef?: string;
  }) => void;
};

function sortCustomers(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) =>
    (a.customer_name || "").localeCompare(b.customer_name || "", undefined, {
      sensitivity: "base",
    }),
  );
}

export function TradeRequestContextBar({
  parameters,
  request,
  productCount,
  readOnly = false,
  showProcurementLineAction = true,
  onSync,
}: TradeRequestContextBarProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    void fetchCustomers({ limit: 1000 })
      .then((res) => {
        if (!cancelled) setCustomers(sortCustomers(res.customers ?? []));
      })
      .catch(() => {
        if (!cancelled) setCustomers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  const customerId = parameters?.customerId || request.customerId || "";
  const clientName = parameters?.clientName.trim() || request.clientName.trim();
  const contactPerson =
    parameters?.contactPerson.trim() || request.contactPerson.trim();
  const requestRef = parameters?.requestRef.trim() || request.requestRef.trim();
  const requestDate =
    parameters?.requestDate.trim() || request.requestDate.trim();

  const missingPipeline = !clientName || !contactPerson || !requestDate || !requestRef;

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.customer_id === customerId),
    [customers, customerId],
  );

  function withGeneratedIds(
    patch: {
      customerId?: string;
      clientName?: string;
      contactPerson?: string;
      requestDate?: string;
      requestRef?: string;
    },
    forceNewIds = false,
  ) {
    const ids = ensurePipelineRequestIds({
      requestDate: forceNewIds ? "" : patch.requestDate ?? requestDate,
      requestRef: forceNewIds ? "" : patch.requestRef ?? requestRef,
    });
    return { ...patch, ...ids };
  }

  function handleCustomerPick(nextCustomerId: string) {
    if (!nextCustomerId) {
      onSync({ customerId: "" });
      return;
    }
    const customer = customers.find((c) => c.customer_id === nextCustomerId);
    onSync(
      withGeneratedIds({
        customerId: nextCustomerId,
        clientName: customer?.customer_name?.trim() || clientName,
        contactPerson:
          customer?.primary_contact_name?.trim() || contactPerson,
      }),
    );
  }

  function handleClientNameChange(nextName: string) {
    const trimmed = nextName.trim();
    const matched = trimmed
      ? customers.find((c) => c.customer_name?.trim() === trimmed)
      : undefined;
    onSync(
      withGeneratedIds({
        clientName: nextName,
        customerId: matched?.customer_id ?? "",
        contactPerson:
          matched?.primary_contact_name?.trim() || contactPerson,
      }),
    );
  }

  return (
    <section className="rounded-xl border border-cyan-500/25 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 sm:p-5 shadow-[0_0_24px_rgba(6,182,212,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/90">
            Customer request · pipeline entry
          </p>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold text-white truncate">
            {clientName || "No customer selected"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            One customer can order multiple products on this request. Add a product
            line below for each SKU, then cost each line separately.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!readOnly && showProcurementLineAction ? (
            <button
              type="button"
              onClick={openNewPipelineWindow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/20 transition"
            >
              <Plus className="h-4 w-4" />
              Add new procurement pipeline line
            </button>
          ) : !readOnly && productCount > 0 ? (
            <span className="text-xs text-slate-500 tabular-nums">
              {productCount} product line{productCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>

      {missingPipeline && !readOnly && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Customer name, contact person, request date, and pipeline number are required
          before saving pipeline lines. Selecting a CRM customer auto-fills a unique
          pipeline code.
        </p>
      )}

      {readOnly ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
          {contactPerson ? (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4 text-slate-500" />
              {contactPerson}
            </span>
          ) : null}
          {requestDate ? <span>Date {requestDate}</span> : null}
          {requestRef ? <span>Ref {requestRef}</span> : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
              CRM customer
            </label>
            <select
              value={customerId}
              onChange={(e) => handleCustomerPick(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select —</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.customer_name}
                  {c.display_id ? ` (${c.display_id})` : ""}
                </option>
              ))}
            </select>
            {customerId ? (
              <Link
                to={`/crm/customers/${customerId}`}
                className="mt-1.5 inline-block text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                Open in CRM →
              </Link>
            ) : null}
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Customer name
            </label>
            <input
              type="text"
              value={parameters?.clientName ?? request.clientName}
              onChange={(e) => handleClientNameChange(e.target.value)}
              placeholder="Buyer on this request"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Contact person
            </label>
            <input
              type="text"
              value={parameters?.contactPerson ?? request.contactPerson}
              onChange={(e) => onSync({ contactPerson: e.target.value })}
              placeholder="Request contact"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Request date
            </label>
            <input
              type="date"
              value={parameters?.requestDate ?? request.requestDate}
              onChange={(e) =>
                onSync(
                  withGeneratedIds({ requestDate: e.target.value }, !requestRef),
                )
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Pipeline / request #
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={parameters?.requestRef ?? request.requestRef}
                onChange={(e) => onSync({ requestRef: e.target.value })}
                placeholder="Unique pipeline number"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() =>
                  onSync({
                    requestRef: generatePipelineRequestRef(
                      parameters?.requestDate ?? request.requestDate,
                    ),
                  })
                }
                className="shrink-0 rounded-lg border border-white/15 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300 hover:bg-slate-800"
              >
                New
              </button>
            </div>
          </div>
        </div>
      )}

      {!readOnly && selectedCustomer?.primary_contact_name?.trim() ? (
        <p className="mt-3 text-xs text-slate-500">
          CRM primary contact: {selectedCustomer.primary_contact_name}
          {selectedCustomer.primary_contact_phone
            ? ` · ${selectedCustomer.primary_contact_phone}`
            : ""}
        </p>
      ) : null}
    </section>
  );
}
