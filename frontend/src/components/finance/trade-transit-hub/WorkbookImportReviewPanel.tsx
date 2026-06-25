import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, X } from "lucide-react";
import { fetchCustomers, type Customer } from "../../../services/api";
import {
  generatePipelineRequestRef,
  validatePipelineRequestFields,
} from "../../../types/tradeParameters";
import type {
  ExpectedCostScenario,
  WorkbookImportMetadata,
} from "../../../utils/expectedCostCsv";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

export type WorkbookImportDraft = {
  customerId: string;
  clientName: string;
  contactPerson: string;
  requestDate: string;
  requestRef: string;
};

type WorkbookImportReviewPanelProps = {
  fileName: string;
  scenarios: ExpectedCostScenario[];
  metadata: WorkbookImportMetadata;
  initial: WorkbookImportDraft;
  onConfirm: (draft: WorkbookImportDraft) => void;
  onCancel: () => void;
};

function sortCustomers(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) =>
    (a.customer_name || "").localeCompare(b.customer_name || "", undefined, {
      sensitivity: "base",
    }),
  );
}

export function WorkbookImportReviewPanel({
  fileName,
  scenarios,
  metadata,
  initial,
  onConfirm,
  onCancel,
}: WorkbookImportReviewPanelProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [draft, setDraft] = useState<WorkbookImportDraft>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  const missingFromCsv = useMemo(
    () => ({
      clientName: !metadata.clientName.trim(),
      contactPerson: !metadata.contactPerson.trim(),
      requestDate: !metadata.requestDate.trim(),
      requestRef: !metadata.requestRef.trim(),
    }),
    [metadata],
  );

  function patchDraft(patch: Partial<WorkbookImportDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setError(null);
  }

  function handleCustomerPick(customerId: string) {
    if (!customerId) {
      patchDraft({ customerId: "" });
      return;
    }
    const customer = customers.find((c) => c.customer_id === customerId);
    patchDraft({
      customerId,
      clientName: customer?.customer_name?.trim() || draft.clientName,
      contactPerson:
        customer?.primary_contact_name?.trim() || draft.contactPerson,
    });
  }

  function handleConfirm() {
    const validationError = validatePipelineRequestFields(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    onConfirm(draft);
  }

  function suggestPipelineRef() {
    patchDraft({
      requestRef: generatePipelineRequestRef(draft.requestDate),
    });
  }

  return (
    <section className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
            Workbook import review
          </p>
          <h3 className="mt-1 text-lg font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            {fileName}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {scenarios.length} product line{scenarios.length === 1 ? "" : "s"}{" "}
            found. Confirm customer and pipeline details before applying.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
          >
            <Check className="h-4 w-4" />
            Apply to request
          </button>
        </div>
      </div>

      {(missingFromCsv.clientName ||
        missingFromCsv.contactPerson ||
        missingFromCsv.requestDate ||
        missingFromCsv.requestRef) && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            This workbook is missing some pipeline fields
            {[
              missingFromCsv.clientName ? "customer name" : null,
              missingFromCsv.contactPerson ? "contact person" : null,
              missingFromCsv.requestDate ? "request date" : null,
              missingFromCsv.requestRef ? "pipeline number" : null,
            ]
              .filter(Boolean)
              .join(", ")}
            . Enter them below before applying.
          </span>
        </p>
      )}

      <ul className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => (
          <li
            key={scenario.id}
            className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-200"
          >
            <span className="font-semibold">{scenario.name}</span>
            <span className="text-slate-500">
              {" "}
              · {scenario.inputs.quantityKg.toLocaleString()} kg
            </span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            CRM customer
          </label>
          <select
            value={draft.customerId}
            onChange={(e) => handleCustomerPick(e.target.value)}
            className={inputClass}
          >
            <option value="">— Select —</option>
            {customers.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.customer_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Customer name *
          </label>
          <input
            type="text"
            value={draft.clientName}
            onChange={(e) => patchDraft({ clientName: e.target.value })}
            placeholder="Required"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Contact person *
          </label>
          <input
            type="text"
            value={draft.contactPerson}
            onChange={(e) => patchDraft({ contactPerson: e.target.value })}
            placeholder="Required"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Request date *
          </label>
          <input
            type="date"
            value={draft.requestDate}
            onChange={(e) => patchDraft({ requestDate: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Pipeline / request number *
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={draft.requestRef}
              onChange={(e) => patchDraft({ requestRef: e.target.value })}
              placeholder="Unique pipeline reference"
              className={inputClass}
            />
            <button
              type="button"
              onClick={suggestPipelineRef}
              className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : null}
    </section>
  );
}
