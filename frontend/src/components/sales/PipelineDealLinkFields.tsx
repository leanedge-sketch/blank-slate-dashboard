import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type {
  ChemicalFullData,
  ChemicalType,
  PipelineStage,
  SalesPipeline,
  Tds,
} from "../../services/api";
import { getPipelineProductLabel, PIPELINE_STAGE_ORDER } from "../../utils/pipelineProduct";

export type DealLinkMode = "new" | "existing";

export interface ProductDealLink {
  mode: DealLinkMode;
  existingPipelineId: string | null;
}

export const DEAL_LINK_KEY_NONE = "__no_product__";

export function emptyProductDealLink(): ProductDealLink {
  return { mode: "new", existingPipelineId: null };
}

/** Match an open deal for this customer + catalog product (or company umbrella). */
export function findPipelineForProduct(
  pipelines: SalesPipeline[],
  productId: string | null,
  chemicals: ChemicalFullData[] = [],
): SalesPipeline | undefined {
  if (productId) {
    const direct = pipelines.find((p) => p.chemical_type_id === productId);
    if (direct) return direct;

    const catalogProduct = chemicals.find((c) => c.uuid_id === productId);
    const productName = catalogProduct?.product_name?.trim().toLowerCase();
    if (productName) {
      return pipelines.find((p) => {
        const meta = (p.metadata || {}) as Record<string, unknown>;
        for (const field of ["product_name", "generic_name", "product"] as const) {
          const raw = meta[field];
          if (typeof raw === "string" && raw.trim().toLowerCase() === productName) {
            return true;
          }
        }
        return false;
      });
    }
    return undefined;
  }
  return pipelines.find((p) => !p.chemical_type_id && !p.tds_id);
}

export function suggestProductDealLink(
  pipelines: SalesPipeline[],
  productId: string | null,
  chemicals: ChemicalFullData[] = [],
): ProductDealLink {
  const match = findPipelineForProduct(pipelines, productId, chemicals);
  if (match) {
    return { mode: "existing", existingPipelineId: match.id };
  }
  return emptyProductDealLink();
}

export function customerHasMatchingPipelines(
  pipelines: SalesPipeline[],
  productIds: string[],
): boolean {
  if (productIds.length === 0) {
    return findPipelineForProduct(pipelines, null) !== undefined;
  }
  return productIds.some((id) => findPipelineForProduct(pipelines, id) !== undefined);
}

interface PipelineDealModeTabsProps {
  mode: DealLinkMode;
  onChange: (mode: DealLinkMode) => void;
  /** When false, Old pipeline tab is disabled (no deals for this customer yet). */
  canContinueExisting?: boolean;
  className?: string;
}

export function PipelineDealModeTabs({
  mode,
  onChange,
  canContinueExisting = true,
  className = "",
}: PipelineDealModeTabsProps) {
  return (
    <div
      className={`inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 ${className}`}
      role="tablist"
      aria-label="Pipeline deal mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "existing"}
        disabled={!canContinueExisting}
        onClick={() => canContinueExisting && onChange("existing")}
        className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
          mode === "existing"
            ? "bg-white text-emerald-800 shadow-sm border border-emerald-200"
            : "text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        Old pipeline
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "new"}
        onClick={() => onChange("new")}
        className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
          mode === "new"
            ? "bg-white text-blue-800 shadow-sm border border-blue-200"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        New pipeline
      </button>
    </div>
  );
}

interface PipelineDealLinkFieldsProps {
  link: ProductDealLink;
  onChange: (link: ProductDealLink) => void;
  customerPipelines: SalesPipeline[];
  productId?: string | null;
  labelOptions: {
    chemicalFullData: ChemicalFullData[];
    chemicalTypes: ChemicalType[];
    tdsList?: Tds[];
  };
  /** Highlight pipelines that match this product */
  preferProductId?: string | null;
  /** Hide tabs when parent renders global tabs */
  hideModeTabs?: boolean;
}

export function PipelineDealLinkFields({
  link,
  onChange,
  customerPipelines,
  productId,
  labelOptions,
  preferProductId,
  hideModeTabs = false,
}: PipelineDealLinkFieldsProps) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "">("");

  const matchedPipeline = useMemo(
    () =>
      findPipelineForProduct(
        customerPipelines,
        preferProductId ?? productId ?? null,
        labelOptions.chemicalFullData,
      ),
    [customerPipelines, preferProductId, productId, labelOptions.chemicalFullData],
  );

  const filteredPipelines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customerPipelines.filter((p) => {
      if (stageFilter && p.stage !== stageFilter) return false;
      const productLabel = getPipelineProductLabel(p, labelOptions);
      if (q) {
        const hay = `${productLabel} ${p.stage} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customerPipelines, search, stageFilter, labelOptions]);

  const sortedPipelines = useMemo(() => {
    const pid = preferProductId ?? productId;
    if (!pid) return filteredPipelines;
    return [...filteredPipelines].sort((a, b) => {
      const aMatch = a.chemical_type_id === pid ? 0 : 1;
      const bMatch = b.chemical_type_id === pid ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [filteredPipelines, preferProductId, productId]);

  function pipelineOptionLabel(p: SalesPipeline): string {
    const product = getPipelineProductLabel(p, labelOptions);
    return `${product} · ${p.stage}${p.version_number ? ` (v${p.version_number})` : ""}`;
  }

  function setMode(mode: DealLinkMode) {
    if (mode === "new") {
      onChange({ mode: "new", existingPipelineId: null });
      return;
    }
    onChange({
      mode: "existing",
      existingPipelineId:
        link.existingPipelineId ?? matchedPipeline?.id ?? null,
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-3">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
        Pipeline for this product
      </p>

      {!hideModeTabs && (
        <PipelineDealModeTabs
          mode={link.mode}
          onChange={setMode}
          canContinueExisting={customerPipelines.length > 0}
        />
      )}

      {link.mode === "existing" && matchedPipeline && (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Recommended: continue{" "}
          <strong>{pipelineOptionLabel(matchedPipeline)}</strong> — same company
          and product.
        </p>
      )}

      {link.mode === "new" && matchedPipeline && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          A pipeline already exists for this product. Choose{" "}
          <strong>Old pipeline</strong> to advance stages instead of duplicating.
        </p>
      )}

      {link.mode === "existing" && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product name…"
                className="w-full pl-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(e) =>
                setStageFilter((e.target.value as PipelineStage) || "")
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All stages</option>
              {PIPELINE_STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <select
            value={link.existingPipelineId || ""}
            onChange={(e) =>
              onChange({
                mode: "existing",
                existingPipelineId: e.target.value || null,
              })
            }
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            size={Math.min(8, Math.max(3, sortedPipelines.length))}
          >
            <option value="">Select existing pipeline…</option>
            {sortedPipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {pipelineOptionLabel(p)}
              </option>
            ))}
          </select>
          {customerPipelines.length === 0 && (
            <p className="text-xs text-amber-700">
              No pipelines for this customer yet. Choose &quot;New pipeline&quot;.
            </p>
          )}
          {customerPipelines.length > 0 && sortedPipelines.length === 0 && (
            <p className="text-xs text-slate-500">
              No pipelines match your search. Clear filters or pick another deal.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Showing {sortedPipelines.length} of {customerPipelines.length} pipeline
            {customerPipelines.length === 1 ? "" : "s"} for this customer
          </p>
        </div>
      )}
    </div>
  );
}
