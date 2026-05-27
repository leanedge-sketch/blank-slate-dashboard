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
}

export function PipelineDealLinkFields({
  link,
  onChange,
  customerPipelines,
  productId,
  labelOptions,
  preferProductId,
}: PipelineDealLinkFieldsProps) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "">("");

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

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-3">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
        Pipeline for this product
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`deal-link-${productId ?? DEAL_LINK_KEY_NONE}`}
            checked={link.mode === "new"}
            onChange={() =>
              onChange({ mode: "new", existingPipelineId: null })
            }
          />
          <span>New pipeline deal</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`deal-link-${productId ?? DEAL_LINK_KEY_NONE}`}
            checked={link.mode === "existing"}
            onChange={() =>
              onChange({
                mode: "existing",
                existingPipelineId: link.existingPipelineId,
              })
            }
          />
          <span>Part of an existing pipeline</span>
        </label>
      </div>

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
              No pipelines for this customer yet. Choose &quot;New pipeline deal&quot;.
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
