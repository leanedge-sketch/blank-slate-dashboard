import { DollarSign, Package, Users } from "lucide-react";
import type {
  CurrencyLedgerRow,
  CustomerLedgerRow,
  CustomerSortMode,
  FxKpiSummary,
  ProductLedgerRow,
  ProductSortMode,
  SelectedEntity,
} from "./executiveReportTypes";
import { formatEtbCompact } from "./executiveReportData";
import { formatUsdCompact } from "./executiveReportFxData";

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

export function FxKpiCards({ kpis }: { kpis: FxKpiSummary }) {
  const cards = [
    {
      label: "Total USD revenue",
      value: formatUsdCompact(kpis.totalUsdRevenue),
      sub: `${kpis.usdAvgMarginPct.toFixed(1)}% avg margin`,
      accent: "from-blue-500/20 to-slate-900/80 border-blue-500/30",
      valueClass: "text-blue-300",
    },
    {
      label: "Total ETB revenue",
      value: `${formatEtbCompact(kpis.totalEtbRevenue)} ETB`,
      sub: `${kpis.etbAvgMarginPct.toFixed(1)}% avg margin`,
      accent: "from-amber-500/20 to-slate-900/80 border-amber-500/30",
      valueClass: "text-amber-300",
    },
    {
      label: "Blended margin (USD vs ETB)",
      value: `${kpis.usdAvgMarginPct.toFixed(1)}% · ${kpis.etbAvgMarginPct.toFixed(1)}%`,
      sub: `${kpis.blendedMarginPct.toFixed(1)}% weighted blend`,
      accent: "from-violet-500/20 to-slate-900/80 border-violet-500/30",
      valueClass: "text-violet-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border bg-gradient-to-br p-4 backdrop-blur-md ${card.accent}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-3.5 w-3.5 text-slate-400" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {card.label}
            </p>
          </div>
          <p className={`text-xl font-bold tabular-nums ${card.valueClass}`}>{card.value}</p>
          <p className="text-[11px] text-slate-500 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}

type CurrencyDeckProps = {
  rows: CurrencyLedgerRow[];
  selected: SelectedEntity;
  onSelect: (type: "customer", id: string, label: string) => void;
};

export function CurrencyLedgerDeck({ rows, selected, onSelect }: CurrencyDeckProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Deck C · Currency ledger</h3>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Customer</th>
              <th className="px-3 py-2.5 font-semibold">Currency</th>
              <th className="px-3 py-2.5 font-semibold text-right">Volume</th>
              <th className="px-4 py-2.5 font-semibold text-right">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No currency rows in range.
                </td>
              </tr>
            ) : (
              rows.slice(0, 14).map((row) => {
                const isActive =
                  selected?.type === "customer" && selected.id === row.id;
                return (
                  <tr
                    key={row.id}
                    className={`cursor-pointer transition ${
                      isActive ? "bg-amber-500/10" : "hover:bg-white/5"
                    }`}
                    onClick={() => onSelect("customer", row.id, row.name)}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-100 truncate max-w-[140px]">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          row.dominantCurrency === "USD"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {row.dominantCurrency}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                      {row.totalVolumeKg.toLocaleString()} kg
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                      {row.avgMarginPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
