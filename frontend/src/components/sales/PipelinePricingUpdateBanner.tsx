import { AlertTriangle } from "lucide-react";
import type { SalesPipeline } from "../../services/api";

type PendingPricing = {
  new_pricing?: {
    price_amount?: number;
    price_currency?: string;
    valid_from?: string;
  };
  previous_price_amount?: number | null;
};

export function PipelinePricingUpdateBanner({
  pipeline,
  onAcceptNew,
  onKeepOld,
  busy,
}: {
  pipeline: SalesPipeline;
  onAcceptNew: () => void | Promise<void>;
  onKeepOld: () => void | Promise<void>;
  busy?: boolean;
}) {
  const pending = (pipeline.metadata as { pending_pricing_update?: PendingPricing } | null)
    ?.pending_pricing_update;
  if (!pending?.new_pricing) return null;

  const newPrice = pending.new_pricing.price_amount;
  const newCur = pending.new_pricing.price_currency ?? pipeline.currency ?? "";
  const oldPrice = pending.previous_price_amount ?? pipeline.unit_price;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Pricing has changed</p>
          <p className="mt-1 text-xs text-amber-900/90">
            This open deal still uses{" "}
            <span className="font-medium">
              {oldPrice != null ? `${oldPrice} ${pipeline.currency ?? ""}` : "its locked price"}
            </span>
            . New catalog pricing is{" "}
            <span className="font-medium">
              {newPrice != null ? `${newPrice} ${newCur}` : "available"}
            </span>
            {pending.new_pricing.valid_from
              ? ` (from ${pending.new_pricing.valid_from})`
              : ""}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onAcceptNew()}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              Use new pricing
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onKeepOld()}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100/80 disabled:opacity-50"
            >
              Keep current deal price
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
