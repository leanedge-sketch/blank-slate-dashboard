import { useEffect, useMemo, useState } from "react";
import type { ImportFinanceProduct, ImportShipmentRow } from "../../../services/importFinance";
import type { FinanceConstants } from "../../../utils/importFinanceCalc";
import { groupSnapshotsByCustomer } from "../../../utils/pipelineSnapshotGroups";
import {
  aggregateTransitFinancialTotals,
  transitItemsFromShipments,
} from "../../../utils/transitRequestItem";
import { PIPELINE_SAVED_EVENT } from "../../../lib/importFinanceEvents";
import {
  type ImportFinancePipelineDomain,
  pipelineDomainLabel,
  PROCUREMENT_PIPELINE_DOMAIN,
} from "../../../lib/pipelineDomains";
import { TransitSummaryTable } from "./summary/TransitSummaryTable";
import {
  ListPager,
  paginateSlice,
  totalPagesFor,
} from "./ListPager";

const CUSTOMERS_PER_PAGE = 5;

type SavedPipelinesTransitSummaryProps = {
  shipments: ImportShipmentRow[];
  products: ImportFinanceProduct[];
  constants: FinanceConstants;
  onReload?: () => void;
  pipelineDomain?: ImportFinancePipelineDomain;
};

export function SavedPipelinesTransitSummary({
  shipments,
  products,
  constants,
  onReload,
  pipelineDomain = PROCUREMENT_PIPELINE_DOMAIN,
}: SavedPipelinesTransitSummaryProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handler = () => {
      onReload?.();
      setPage(1);
    };
    window.addEventListener(PIPELINE_SAVED_EVENT, handler);
    return () => window.removeEventListener(PIPELINE_SAVED_EVENT, handler);
  }, [onReload]);

  const customerBuckets = useMemo(
    () => groupSnapshotsByCustomer(shipments, products),
    [shipments, products],
  );

  const totalPages = totalPagesFor(customerBuckets.length, CUSTOMERS_PER_PAGE);
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleCustomers = paginateSlice(
    customerBuckets,
    safePage,
    CUSTOMERS_PER_PAGE,
  );

  if (customerBuckets.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-500">
        No saved {pipelineDomainLabel(pipelineDomain).toLowerCase()} requests yet. Save
        product lines from costing to populate this view.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500/90">
            Saved {pipelineDomainLabel(pipelineDomain).toLowerCase()} requests
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {pipelineDomainLabel(pipelineDomain)} snapshots only — separate from{" "}
            {pipelineDomain === PROCUREMENT_PIPELINE_DOMAIN
              ? "CRM sales deals"
              : "procurement import requests"}
            .
          </p>
        </div>
        <ListPager
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          itemLabel="customers"
          totalItems={customerBuckets.length}
          pageSize={CUSTOMERS_PER_PAGE}
        />
      </div>

      {visibleCustomers.map((bucket) => {
        const rows = bucket.requestGroups.flatMap((group) => group.rows);
        const items = transitItemsFromShipments(rows, products, constants);
        const totals = aggregateTransitFinancialTotals(items, {
          quantityKg: rows.reduce(
            (sum, row) => sum + (Number(row.quantity_kg) || 0),
            0,
          ),
          capitalOutlayEtb: rows.reduce(
            (sum, row) => sum + (Number(row.capital_outlay_etb) || 0),
            0,
          ),
          customsPaidEtb: rows.reduce(
            (sum, row) => sum + (Number(row.total_customs_paid_etb) || 0),
            0,
          ),
        });

        return (
          <div key={bucket.key} className="space-y-2">
            <p className="text-[11px] text-slate-500">
              {bucket.requestGroups.length} saved request
              {bucket.requestGroups.length === 1 ? "" : "s"} ·{" "}
              {items.length} product line{items.length === 1 ? "" : "s"}
            </p>
            <TransitSummaryTable
              clientName={bucket.clientName}
              items={items}
              totals={totals}
              customsPaidEtb={totals.customsPaidEtb}
              fullPanel
            />
          </div>
        );
      })}

      <ListPager
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        itemLabel="customers"
        totalItems={customerBuckets.length}
        pageSize={CUSTOMERS_PER_PAGE}
      />
    </div>
  );
}
