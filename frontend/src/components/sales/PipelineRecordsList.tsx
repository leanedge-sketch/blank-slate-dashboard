import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  FileText,
  Folder,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import type { Customer, ChemicalFullData, ChemicalType, PipelineStage, SalesPipeline, Tds } from "../../services/api";
import {
  formatPipelineQuantity,
  getPipelineProductLabel,
} from "../../utils/pipelineProduct";

const ROWS_PER_PAGE = 25;
const CUSTOMERS_PER_PAGE = 10;
const STAGE_COLORS: Record<PipelineStage, string> = {
  "Lead ID": "bg-slate-100 text-slate-700 border-slate-300",
  Discovery: "bg-blue-100 text-blue-700 border-blue-300",
  Sample: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Validation: "bg-orange-100 text-orange-700 border-orange-300",
  Proposal: "bg-indigo-100 text-indigo-700 border-indigo-300",
  Confirmation: "bg-green-100 text-green-700 border-green-300",
  Closed: "bg-emerald-500 text-white border-emerald-600",
  Lost: "bg-red-500 text-white border-red-600",
};

type ViewMode = "table" | "grouped";
type SortMode = "updated" | "customer" | "stage" | "amount";

type PipelineRecordsListProps = {
  pipelines: SalesPipeline[];
  customers: Customer[];
  productLabelOptions: {
    chemicalFullData?: ChemicalFullData[];
    chemicalTypes?: ChemicalType[];
    tdsList?: Tds[];
  };
  loading?: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onView: (pipelineId: string) => void;
  onEdit: (pipelineId: string) => void;
  onDelete: (pipelineId: string) => void;
  onQuotation: (pipelineId: string) => void;
  deletingId?: string | null;
  onCreateFirst?: () => void;
};

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function pipelineTimestamp(pipeline: SalesPipeline): number {
  const raw = pipeline.updated_at || pipeline.created_at;
  return raw ? new Date(raw).getTime() : 0;
}

const STAGE_RANK: Record<PipelineStage, number> = {
  "Lead ID": 0,
  Discovery: 1,
  Sample: 2,
  Validation: 3,
  Proposal: 4,
  Confirmation: 5,
  Closed: 6,
  Lost: 7,
};

export function PipelineRecordsList({
  pipelines,
  customers,
  productLabelOptions,
  loading = false,
  searchQuery,
  onSearchChange,
  onView,
  onEdit,
  onDelete,
  onQuotation,
  deletingId = null,
  onCreateFirst,
}: PipelineRecordsListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortBy, setSortBy] = useState<SortMode>("updated");
  const [page, setPage] = useState(1);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(
    new Set(),
  );

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) {
      map.set(c.customer_id, c.customer_name);
    }
    return map;
  }, [customers]);

  function getCustomerName(customerId: string | null | undefined): string {
    if (!customerId) return "Unknown customer";
    return customerNameById.get(customerId) ?? customerId;
  }

  function getProductName(pipeline: SalesPipeline): string {
    return getPipelineProductLabel(pipeline, productLabelOptions);
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pipelines;
    return pipelines.filter((p) => {
      const customer = getCustomerName(p.customer_id).toLowerCase();
      const product = getProductName(p).toLowerCase();
      const stage = (p.stage || "").toLowerCase();
      return customer.includes(q) || product.includes(q) || stage.includes(q);
    });
  }, [pipelines, searchQuery, customerNameById, productLabelOptions]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sortBy === "customer") {
        const nameA = getCustomerName(a.customer_id);
        const nameB = getCustomerName(b.customer_id);
        const cmp = nameA.localeCompare(nameB);
        if (cmp !== 0) return cmp;
        return pipelineTimestamp(b) - pipelineTimestamp(a);
      }
      if (sortBy === "stage") {
        const rankA = STAGE_RANK[a.stage] ?? 99;
        const rankB = STAGE_RANK[b.stage] ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        return pipelineTimestamp(b) - pipelineTimestamp(a);
      }
      if (sortBy === "amount") {
        const amtA = a.amount ?? 0;
        const amtB = b.amount ?? 0;
        if (amtB !== amtA) return amtB - amtA;
        return pipelineTimestamp(b) - pipelineTimestamp(a);
      }
      return pipelineTimestamp(b) - pipelineTimestamp(a);
    });
    return rows;
  }, [filtered, sortBy, customerNameById]);

  const customerGroups = useMemo(() => {
    const map = new Map<string, SalesPipeline[]>();
    for (const pipeline of sorted) {
      const key = pipeline.customer_id || "unknown";
      const list = map.get(key) ?? [];
      list.push(pipeline);
      map.set(key, list);
    }
    return [...map.entries()].map(([customerId, deals]) => ({
      customerId,
      customerName: getCustomerName(customerId === "unknown" ? null : customerId),
      deals,
      latestTs: Math.max(...deals.map(pipelineTimestamp)),
    }));
  }, [sorted, customerNameById]);

  const tableTotalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const groupTotalPages = Math.max(
    1,
    Math.ceil(customerGroups.length / CUSTOMERS_PER_PAGE),
  );
  const totalPages = viewMode === "table" ? tableTotalPages : groupTotalPages;
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortBy, viewMode, pipelines.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = sorted.slice(
    (safePage - 1) * ROWS_PER_PAGE,
    safePage * ROWS_PER_PAGE,
  );
  const pageGroups = customerGroups.slice(
    (safePage - 1) * CUSTOMERS_PER_PAGE,
    safePage * CUSTOMERS_PER_PAGE,
  );

  function toggleCustomer(customerId: string) {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  function expandAllOnPage() {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      for (const g of pageGroups) next.add(g.customerId);
      return next;
    });
  }

  function collapseAll() {
    setExpandedCustomers(new Set());
  }

  function ActionButtons({ pipeline }: { pipeline: SalesPipeline }) {
    return (
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuotation(pipeline.id);
          }}
          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
          title="Create quotation"
        >
          <FileText className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(pipeline.id);
          }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(pipeline.id);
          }}
          disabled={deletingId === pipeline.id}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          title="Delete"
        >
          {deletingId === pipeline.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Sales deals
              </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {sorted.length} deal{sorted.length === 1 ? "" : "s"}
              {searchQuery.trim() && pipelines.length !== sorted.length
                ? ` (filtered from ${pipelines.length})`
                : ""}
              {customerGroups.length > 0
                ? ` · ${customerGroups.length} customer${
                    customerGroups.length === 1 ? "" : "s"
                  }`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grouped")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === "grouped"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                By customer
              </button>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="updated">Recently updated</option>
              <option value="customer">Customer A–Z</option>
              <option value="stage">Stage</option>
              <option value="amount">Quantity</option>
            </select>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search customer, product, or stage…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading pipelines…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-12 text-center">
          <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">
            {pipelines.length === 0
              ? "No pipeline records found."
              : "No records match your search."}
          </p>
          {pipelines.length === 0 && onCreateFirst ? (
            <button
              type="button"
              onClick={onCreateFirst}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-semibold"
            >
              Create first pipeline
            </button>
          ) : null}
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium text-right">Quantity</th>
                <th className="px-4 py-3 font-medium">Expected close</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((pipeline) => (
                <tr
                  key={pipeline.id}
                  onClick={() => onView(pipeline.id)}
                  className="border-b border-slate-100 hover:bg-emerald-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-[180px] truncate">
                    {getCustomerName(pipeline.customer_id)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[220px]">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{getProductName(pipeline)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        STAGE_COLORS[pipeline.stage]
                      }`}
                    >
                      {pipeline.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800">
                    {formatPipelineQuantity(pipeline.amount, pipeline.unit)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(pipeline.expected_close_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {formatDate(pipeline.updated_at || pipeline.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <ActionButtons pipeline={pipeline} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={expandAllOnPage}
              className="text-emerald-700 hover:text-emerald-900 font-medium"
            >
              Expand all on page
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              Collapse all
            </button>
          </div>
          {pageGroups.map((group) => {
            const isExpanded = expandedCustomers.has(group.customerId);
            return (
              <div
                key={group.customerId}
                className="rounded-xl border border-slate-200 overflow-hidden bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggleCustomer(group.customerId)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {group.customerName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {group.deals.length} product deal
                        {group.deals.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isExpanded ? (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                          <th className="px-4 py-2 text-left font-medium">Product</th>
                          <th className="px-4 py-2 text-left font-medium">Stage</th>
                          <th className="px-4 py-2 text-right font-medium">Qty</th>
                          <th className="px-4 py-2 text-left font-medium">Close</th>
                          <th className="px-4 py-2 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.deals.map((pipeline) => (
                          <tr
                            key={pipeline.id}
                            onClick={() => onView(pipeline.id)}
                            className="border-b border-slate-50 hover:bg-emerald-50/40 cursor-pointer"
                          >
                            <td className="px-4 py-2.5 text-slate-800 max-w-[200px] truncate">
                              {getProductName(pipeline)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  STAGE_COLORS[pipeline.stage]
                                }`}
                              >
                                {pipeline.stage}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                              {formatPipelineQuantity(pipeline.amount, pipeline.unit)}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                              {formatDate(pipeline.expected_close_date)}
                            </td>
                            <td className="px-4 py-2.5">
                              <ActionButtons pipeline={pipeline} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {sorted.length > 0 && totalPages > 1 ? (
        <div className="px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {viewMode === "table"
              ? `Showing ${(safePage - 1) * ROWS_PER_PAGE + 1}–${Math.min(
                  safePage * ROWS_PER_PAGE,
                  sorted.length,
                )} of ${sorted.length} deals`
              : `Showing customers ${(safePage - 1) * CUSTOMERS_PER_PAGE + 1}–${Math.min(
                  safePage * CUSTOMERS_PER_PAGE,
                  customerGroups.length,
                )} of ${customerGroups.length}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-slate-600 tabular-nums">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
