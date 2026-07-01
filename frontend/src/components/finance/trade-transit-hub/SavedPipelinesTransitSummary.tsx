import { useEffect, useMemo, useState } from "react";
import type { ImportFinanceProduct, ImportShipmentRow } from "../../../services/importFinance";
import type { FinanceConstants } from "../../../utils/importFinanceCalc";
import { groupSnapshotsByCustomer } from "../../../utils/pipelineSnapshotGroups";
import {
  aggregateTransitFinancialTotals,
  transitItemsFromShipments,
} from "../../../utils/transitRequestItem";
import { PIPELINE_DELETED_EVENT, PIPELINE_SAVED_EVENT } from "../../../lib/importFinanceEvents";
import {
  type ImportFinancePipelineDomain,
  pipelineDomainLabel,
  PROCUREMENT_PIPELINE_DOMAIN,
} from "../../../lib/pipelineDomains";
import { TransitSummaryTable } from "./summary/TransitSummaryTable";
import { DeletePipelineRequestButton } from "./DeletePipelineRequestButton";
import {
  TransitSummarySearchSection,
  pipelineGroupMatchesSearch,
  type TransitSummarySearchFilter,
} from "./TransitSummarySearchSection";
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
  searchCompany?: string;
  searchContact?: string;
  showSearch?: boolean;
};

export function SavedPipelinesTransitSummary({
  shipments,
  products,
  constants,
  onReload,
  pipelineDomain = PROCUREMENT_PIPELINE_DOMAIN,
  searchCompany = "",
  searchContact = "",
  showSearch = false,
}: SavedPipelinesTransitSummaryProps) {
  const [page, setPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState<TransitSummarySearchFilter>({
    company: searchCompany,
    contact: searchContact,
  });

  useEffect(() => {
    const handler = () => {
      onReload?.();
      setPage(1);
    };
    window.addEventListener(PIPELINE_SAVED_EVENT, handler);
    window.addEventListener(PIPELINE_DELETED_EVENT, handler);
    return () => {
      window.removeEventListener(PIPELINE_SAVED_EVENT, handler);
      window.removeEventListener(PIPELINE_DELETED_EVENT, handler);
    };
  }, [onReload]);

  const customerBuckets = useMemo(() => {
    const buckets = groupSnapshotsByCustomer(shipments, products);
    const hasFilter =
      searchFilter.company.trim() || searchFilter.contact.trim();
    if (!hasFilter) return buckets;

    return buckets
      .map((bucket) => ({
        ...bucket,
        requestGroups: bucket.requestGroups.filter((group) =>
          pipelineGroupMatchesSearch(
            group.clientName,
            group.contactPerson,
            group.requestRef,
            searchFilter,
          ),
        ),
      }))
      .filter((bucket) => bucket.requestGroups.length > 0);
  }, [shipments, products, searchFilter]);

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
    const hasFilter =
      searchFilter.company.trim() || searchFilter.contact.trim();
    return (
      <div className="space-y-4">
        {showSearch ? (
          <TransitSummarySearchSection
            initialCompany={searchCompany}
            initialContact={searchContact}
            onFilterChange={setSearchFilter}
          />
        ) : null}
        <p className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-500">
          {hasFilter
            ? "No saved requests match your search. Try different company or contact terms."
            : `No saved ${pipelineDomainLabel(pipelineDomain).toLowerCase()} requests yet. Save product lines from costing to populate this view.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showSearch ? (
        <TransitSummarySearchSection
          initialCompany={searchCompany}
          initialContact={searchContact}
          onFilterChange={setSearchFilter}
        />
      ) : null}
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

      {visibleCustomers.map((bucket) => (
        <div key={bucket.key} className="space-y-4">
          {bucket.requestGroups.length > 1 ? (
            <p className="text-sm font-semibold text-slate-200">{bucket.clientName}</p>
          ) : null}
          {bucket.requestGroups.map((group) => {
            const items = transitItemsFromShipments(group.rows, products, constants);
            const totals = aggregateTransitFinancialTotals(items, {
              quantityKg: group.totals.quantityKg,
              capitalOutlayEtb: group.totals.capitalOutlayEtb,
              customsPaidEtb: group.totals.customsEtb,
            });

            return (
              <div key={group.key} className="space-y-2">
                <TransitSummaryTable
                  clientName={group.clientName}
                  contactPerson={group.contactPerson}
                  requestRef={group.requestRef}
                  items={items}
                  totals={totals}
                  customsPaidEtb={totals.customsPaidEtb}
                  fullPanel
                  headerActions={
                    <DeletePipelineRequestButton
                      group={group}
                      size="md"
                      label="Delete entire request"
                      onDeleted={() => onReload?.()}
                    />
                  }
                />
              </div>
            );
          })}
        </div>
      ))}

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
