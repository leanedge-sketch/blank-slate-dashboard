import { Package, Users } from "lucide-react";
import type {
  CustomerLedgerRow,
  CustomerSortMode,
  ProductLedgerRow,
  ProductSortMode,
  SelectedEntity,
} from "./executiveReportTypes";
import { formatEtbCompact } from "./executiveReportData";

type LedgerDeckProps<T extends { id: string; name: string }> = {
  title: string;
  icon: typeof Package;
  rows: T[];
  selected: SelectedEntity;
  onSelect: (type: "product" | "customer", id: string, label: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  sortOptions: { value: string; label: string }[];
  renderRow: (row: T) => { primary: string; secondary: string };
  entityType: "product" | "customer";
};

function LedgerDeck<T extends { id: string; name: string }>({
  title,
  icon: Icon,
  rows,
  selected,
  onSelect,
  sort,
  onSortChange,
  sortOptions,
  renderRow,
  entityType,
}: LedgerDeckProps<T>) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <ul className="max-h-[240px] overflow-y-auto divide-y divide-white/5 scrollbar-thin">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-xs text-slate-500 text-center">No rows in range.</li>
        ) : (
          rows.slice(0, 12).map((row) => {
            const isActive =
              selected?.type === entityType && selected.id === row.id;
            const { primary, secondary } = renderRow(row);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(entityType, row.id, row.name)}
                  className={`w-full px-4 py-3 text-left transition ${
                    isActive
                      ? "bg-cyan-500/15 border-l-2 border-cyan-400"
                      : "hover:bg-white/5 border-l-2 border-transparent"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-100 truncate">{row.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">{secondary}</p>
                  <p className="text-[10px] text-cyan-500/80 mt-1">{primary}</p>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

type ProductDeckProps = {
  rows: ProductLedgerRow[];
  selected: SelectedEntity;
  sort: ProductSortMode;
  onSortChange: (sort: ProductSortMode) => void;
  onSelect: (type: "product" | "customer", id: string, label: string) => void;
};

export function ProductLedgerDeck({
  rows,
  selected,
  sort,
  onSortChange,
  onSelect,
}: ProductDeckProps) {
  return (
    <LedgerDeck
      title="Deck A · Products"
      icon={Package}
      rows={rows}
      selected={selected}
      onSelect={onSelect}
      sort={sort}
      onSortChange={(v) => onSortChange(v as ProductSortMode)}
      entityType="product"
      sortOptions={[
        { value: "frequency", label: "By frequency" },
        { value: "profit", label: "By profit" },
      ]}
      renderRow={(row) => ({
        primary:
          sort === "frequency"
            ? `${row.shipmentCount} pipeline run${row.shipmentCount === 1 ? "" : "s"}`
            : `${formatEtbCompact(row.totalProfitEtb)} ETB profit`,
        secondary: `${row.totalVolumeKg.toLocaleString()} kg · ${row.avgMarginPct.toFixed(1)}% margin`,
      })}
    />
  );
}

type CustomerDeckProps = {
  rows: CustomerLedgerRow[];
  selected: SelectedEntity;
  sort: CustomerSortMode;
  onSortChange: (sort: CustomerSortMode) => void;
  onSelect: (type: "product" | "customer", id: string, label: string) => void;
};

export function CustomerLedgerDeck({
  rows,
  selected,
  sort,
  onSortChange,
  onSelect,
}: CustomerDeckProps) {
  return (
    <LedgerDeck
      title="Deck B · Customers"
      icon={Users}
      rows={rows}
      selected={selected}
      onSelect={onSelect}
      sort={sort}
      onSortChange={(v) => onSortChange(v as CustomerSortMode)}
      entityType="customer"
      sortOptions={[
        { value: "volume", label: "By volume" },
        { value: "margin", label: "By margin" },
      ]}
      renderRow={(row) => ({
        primary:
          sort === "volume"
            ? `${row.totalVolumeKg.toLocaleString()} kg total`
            : `${row.avgMarginPct.toFixed(1)}% avg margin`,
        secondary: `${formatEtbCompact(row.totalRevenueEtb)} ETB revenue · ${row.shipmentCount} runs`,
      })}
    />
  );
}
