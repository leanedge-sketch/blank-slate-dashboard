import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Trash2 } from "lucide-react";
import type { PMSProduct, PricingRecord } from "./types";
import { CurrencyBadge } from "./CurrencyBadge";
import { formatAmount } from "./utils";

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP"];
const ROW_HEIGHT = 64;
const EDIT_COLS = 3;

export type PendingPricingPatch = {
  incoterm: string;
  costAmount: string;
  priceAmount: string;
};

export type BulkPricingChange = {
  id: string;
  incoterm: string;
  costAmount: number;
  priceAmount: number;
};

type PricingVirtualGridProps = {
  records: PricingRecord[];
  pmsProducts: PMSProduct[];
  readOnly?: boolean;
  marginCell: (record: PricingRecord) => ReactNode;
  statusCell: (record: PricingRecord) => ReactNode;
  onSavePending: (changes: BulkPricingChange[]) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
};

export function PricingVirtualGrid({
  records,
  pmsProducts,
  readOnly = false,
  marginCell,
  statusCell,
  onSavePending,
  onDelete,
}: PricingVirtualGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<Record<string, PendingPricingPatch>>({});
  const [saving, setSaving] = useState(false);

  const productById = useMemo(() => {
    const map = new Map<string, PMSProduct>();
    for (const p of pmsProducts) map.set(p.id, p);
    return map;
  }, [pmsProducts]);

  const virtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  });

  const pendingCount = Object.keys(pending).length;

  const patchRecord = useCallback((recordId: string, patch: Partial<PendingPricingPatch>, record: PricingRecord) => {
    setPending((prev) => {
      const current = prev[recordId] ?? {
        incoterm: record.incoterm,
        costAmount: String(record.costAmount),
        priceAmount: String(record.priceAmount),
      };
      const next = { ...current, ...patch };
      const unchanged =
        next.incoterm === record.incoterm &&
        Number(next.costAmount) === record.costAmount &&
        Number(next.priceAmount) === record.priceAmount;
      if (unchanged) {
        const { [recordId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [recordId]: next };
    });
  }, []);

  function focusCell(rowIndex: number, col: number) {
    const el = parentRef.current?.querySelector<HTMLElement>(
      `[data-grid-cell="${rowIndex}-${col}"]`,
    );
    el?.focus();
  }

  function onCellTab(event: KeyboardEvent<HTMLElement>, rowIndex: number, col: number) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    let nextRow = rowIndex;
    let nextCol = event.shiftKey ? col - 1 : col + 1;
    if (nextCol >= EDIT_COLS) {
      nextCol = 0;
      nextRow += 1;
    } else if (nextCol < 0) {
      nextCol = EDIT_COLS - 1;
      nextRow -= 1;
    }
    if (nextRow < 0 || nextRow >= records.length) return;
    virtualizer.scrollToIndex(nextRow);
    requestAnimationFrame(() => focusCell(nextRow, nextCol));
  }

  async function savePending() {
    const changes: BulkPricingChange[] = [];
    for (const [id, patch] of Object.entries(pending)) {
      const costAmount = Number(patch.costAmount);
      const priceAmount = Number(patch.priceAmount);
      if (Number.isNaN(costAmount) || Number.isNaN(priceAmount)) continue;
      changes.push({
        id,
        incoterm: patch.incoterm,
        costAmount,
        priceAmount,
      });
    }
    if (!changes.length) return;
    try {
      setSaving(true);
      await onSavePending(changes);
      setPending({});
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-[240px] flex-col overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Inline grid · Tab between cells · edits stay local until save
        </p>
        <button
          type="button"
          disabled={readOnly || saving || pendingCount === 0}
          onClick={() => void savePending()}
          className="rounded-full bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : `Save ${pendingCount} Pending Changes`}
        </button>
      </div>
      <div className="grid grid-cols-[minmax(10rem,1.4fr)_6rem_8.5rem_8.5rem_8rem_8rem_3.5rem] gap-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Product</span>
        <span>Incoterm</span>
        <span>Cost</span>
        <span>Price</span>
        <span>Margin</span>
        <span>Status</span>
        <span className="text-right"> </span>
      </div>
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const record = records[virtualRow.index];
            if (!record) return null;
            const draft = pending[record.id];
            return (
              <div
                key={record.id}
                className="absolute left-0 top-0 w-full border-b border-slate-100"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <GridRow
                  record={record}
                  rowIndex={virtualRow.index}
                  product={productById.get(record.pmsProductId)}
                  readOnly={readOnly || record.status === "historical"}
                  draft={draft}
                  dirty={Boolean(draft)}
                  marginCell={marginCell}
                  statusCell={statusCell}
                  onPatch={patchRecord}
                  onTab={onCellTab}
                  onDelete={onDelete}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GridRow({
  record,
  rowIndex,
  product,
  readOnly,
  draft,
  dirty,
  marginCell,
  statusCell,
  onPatch,
  onTab,
  onDelete,
}: {
  record: PricingRecord;
  rowIndex: number;
  product?: PMSProduct;
  readOnly: boolean;
  draft?: PendingPricingPatch;
  dirty: boolean;
  marginCell: (record: PricingRecord) => ReactNode;
  statusCell: (record: PricingRecord) => ReactNode;
  onPatch: (recordId: string, patch: Partial<PendingPricingPatch>, record: PricingRecord) => void;
  onTab: (event: KeyboardEvent<HTMLElement>, rowIndex: number, col: number) => void;
  onDelete: (recordId: string) => Promise<void>;
}) {
  const incoterm = draft?.incoterm ?? record.incoterm;
  const costAmount = draft?.costAmount ?? String(record.costAmount);
  const priceAmount = draft?.priceAmount ?? String(record.priceAmount);

  return (
    <div
      className={`grid h-full grid-cols-[minmax(10rem,1.4fr)_6rem_8.5rem_8.5rem_8rem_8rem_3.5rem] items-center gap-0 px-3 text-sm ${
        record.status === "historical"
          ? "bg-slate-50 text-slate-500"
          : dirty
            ? "bg-amber-50/70"
            : "bg-white"
      }`}
    >
      <div className="min-w-0 pr-2">
        <p className="truncate font-medium text-slate-900">{product?.sku ?? "—"}</p>
        <p className="truncate text-xs text-slate-500">{product?.name ?? record.pmsProductId}</p>
      </div>
      <div>
        <select
          data-grid-cell={`${rowIndex}-0`}
          value={incoterm}
          disabled={readOnly}
          onKeyDown={(e) => onTab(e, rowIndex, 0)}
          onChange={(e) => onPatch(record.id, { incoterm: e.target.value }, record)}
          className="w-full rounded border border-slate-200 bg-white px-1 py-1 text-xs disabled:border-transparent disabled:bg-transparent"
        >
          {INCOTERMS.map((term) => (
            <option key={term} value={term}>
              {term}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <CurrencyBadge currency={record.costCurrency} variant="cost" />
        <input
          data-grid-cell={`${rowIndex}-1`}
          type="number"
          step="0.01"
          value={costAmount}
          disabled={readOnly}
          onKeyDown={(e) => onTab(e, rowIndex, 1)}
          onChange={(e) => onPatch(record.id, { costAmount: e.target.value }, record)}
          className="w-20 rounded border border-slate-200 px-1.5 py-1 text-right text-xs tabular-nums disabled:border-transparent disabled:bg-transparent"
        />
      </div>
      <div className="flex items-center gap-1">
        <CurrencyBadge currency={record.priceCurrency} variant="price" />
        <input
          data-grid-cell={`${rowIndex}-2`}
          type="number"
          step="0.01"
          value={priceAmount}
          disabled={readOnly}
          onKeyDown={(e) => onTab(e, rowIndex, 2)}
          onChange={(e) => onPatch(record.id, { priceAmount: e.target.value }, record)}
          className="w-20 rounded border border-slate-200 px-1.5 py-1 text-right text-xs tabular-nums disabled:border-transparent disabled:bg-transparent"
        />
      </div>
      <div>{marginCell(record)}</div>
      <div>{statusCell(record)}</div>
      <div className="text-right">
        <button
          type="button"
          disabled={readOnly}
          title="Delete this version"
          onClick={() => {
            if (
              window.confirm(
                `Delete ${product?.name ?? record.pmsProductId} (${formatAmount(record.priceAmount)} ${record.priceCurrency})?`,
              )
            ) {
              void onDelete(record.id);
            }
          }}
          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
