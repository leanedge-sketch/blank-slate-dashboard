import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Info,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import {
  formatEtb,
  formatNumber,
  formatUsd,
  type FinanceConstants,
  DEFAULT_FINANCE_CONSTANTS,
} from "../../utils/importFinanceCalc";
import {
  calculateTradeTransit,
  DEFAULT_TRADE_TRANSIT_INPUTS,
  type TradeTransitInputs,
  type TradeTransitResult,
} from "../../utils/tradeTransitCalc";

export { DEFAULT_TRADE_TRANSIT_INPUTS };
export const DEFAULT_IMPORT_FINANCE_INPUTS = DEFAULT_TRADE_TRANSIT_INPUTS;

type ImportFinanceCalculatorPanelProps = {
  inputs: TradeTransitInputs;
  onChange: (patch: Partial<TradeTransitInputs>) => void;
  constants?: FinanceConstants;
  compact?: boolean;
};

type Accent = "cyan" | "amber" | "emerald" | "purple";

const accentTitle: Record<Accent, string> = {
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
  purple: "text-purple-400",
};

const accentIcon: Record<Accent, string> = {
  cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const accentBorderOpen: Record<Accent, string> = {
  cyan: "border-cyan-500/30",
  amber: "border-amber-500/30",
  emerald: "border-emerald-500/30",
  purple: "border-purple-500/30",
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums font-mono text-[11px] text-slate-300 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

function FxConversion({
  leftLabel,
  leftValue,
  rate,
  rateLabel,
  rightLabel,
  rightValue,
  accent,
}: {
  leftLabel: string;
  leftValue: string;
  rate: number;
  rateLabel: string;
  rightLabel: string;
  rightValue: string;
  accent: Accent;
}) {
  const rateColor =
    accent === "cyan"
      ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/25"
      : "text-amber-400 bg-amber-500/10 border-amber-500/25";

  return (
    <div className="my-2 rounded-lg border border-white/5 bg-black/25 px-3 py-2 space-y-1">
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-slate-500">{leftLabel}</span>
        <span className="font-mono tabular-nums text-slate-300">{leftValue}</span>
      </div>
      <div className="flex items-center justify-center gap-2 py-0.5">
        <span className="text-slate-600 text-[10px]">×</span>
        <span
          className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${rateColor}`}
        >
          {rateLabel} {formatNumber(rate, 2)}
        </span>
        <span className="text-slate-600 text-[10px]">=</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className={`text-xs ${accentTitle[accent]}`}>{rightLabel}</span>
        <span className={`text-sm font-bold tabular-nums ${accentTitle[accent]}`}>
          {rightValue}
        </span>
      </div>
    </div>
  );
}

function PipelineAccordion({
  stage,
  title,
  icon,
  accent,
  kpiLabel,
  kpiValue,
  kpiSub,
  open,
  onToggle,
  children,
}: {
  stage: number;
  title: string;
  icon: ReactNode;
  accent: Accent;
  kpiLabel: string;
  kpiValue: string;
  kpiSub?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border backdrop-blur-md transition-all ${
        open
          ? `bg-slate-900/60 ${accentBorderOpen[accent]}`
          : "bg-slate-900/40 border-white/10 hover:border-white/20"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3.5 text-left"
        aria-expanded={open}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${accentIcon[accent]}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Stage {stage}
          </p>
          <p className={`text-sm font-semibold truncate ${accentTitle[accent]}`}>
            {title}
          </p>
        </div>
        <div className="text-right shrink-0 max-w-[45%]">
          <p className="text-[9px] uppercase tracking-wider text-slate-500 truncate">
            {kpiLabel}
          </p>
          <p className={`text-base sm:text-lg font-bold tabular-nums leading-tight ${accentTitle[accent]}`}>
            {kpiValue}
          </p>
          {kpiSub && (
            <p className="text-[10px] text-slate-500 tabular-nums">{kpiSub}</p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-white/5 mx-3.5 mb-3.5 mt-0 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function PipelineStack({
  result,
  inputs,
  constants,
  qty,
}: {
  result: TradeTransitResult;
  inputs: TradeTransitInputs;
  constants: FinanceConstants;
  qty: number;
}) {
  const [openStage, setOpenStage] = useState<number | null>(null);
  const s1 = result.stage1;
  const s2 = result.stage2;
  const s3 = result.stage3;
  const s4 = result.stage4;
  const positive = s4.profitPerKgEtb >= 0;

  const taxes = [
    { label: `Duty (${(constants.customsDutyPct * 100).toFixed(0)}%)`, value: s2.dutyEtb },
    { label: `Scan (${(constants.scanFeePct * 100).toFixed(2)}%)`, value: s2.scanFeeEtb },
    { label: `Social (${(constants.socialFeePct * 100).toFixed(0)}%)`, value: s2.socialFeeEtb },
    {
      label: `Special (${inputs.taxSpecialGoodsPct.toFixed(0)}%)`,
      value: s2.specialGoodsEtb,
    },
    { label: `WHT (${(constants.whtPct * 100).toFixed(0)}%)`, value: s2.whtEtb },
    { label: `VAT (${(constants.vatPct * 100).toFixed(0)}%)`, value: s2.vatEtb },
    { label: "Surtax (0%)", value: s2.surtaxEtb },
    { label: "Excise (0%)", value: s2.exciseEtb },
  ];

  function toggle(stage: number) {
    setOpenStage((prev) => (prev === stage ? null : stage));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1 px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/70">
          Pipeline ledger
        </p>
        <p className="text-[10px] text-slate-600">Click to expand audit trail</p>
      </div>

      <PipelineAccordion
        stage={1}
        title="Origin & Border Outlay"
        accent="cyan"
        icon={<MapPin className="h-4 w-4" />}
        kpiLabel="Capital outlay · parallel"
        kpiValue={formatEtb(s1.capitalOutlayEtb, 0)}
        kpiSub={`@ ${formatNumber(s1.capitalParallelRate, 0)} ETB/USD`}
        open={openStage === 1}
        onToggle={() => toggle(1)}
      >
        <DetailRow label="Material USD/kg" value={formatUsd(s1.materialUsdPerKg)} />
        <DetailRow label="+ Transport USD/kg" value={formatUsd(s1.transportUsdPerKg)} />
        {s1.miscBorderUsdTotal > 0 && (
          <DetailRow label="+ Misc border USD" value={formatUsd(s1.miscBorderUsdTotal, 2)} />
        )}
        <DetailRow
          label={`Border × ${formatNumber(qty, 0)} kg`}
          value={formatUsd(s1.totalBorderUsd, 2)}
        />
        <FxConversion
          leftLabel="USD border total"
          leftValue={formatUsd(s1.totalBorderUsd, 2)}
          rate={s1.capitalParallelRate}
          rateLabel="Parallel"
          rightLabel="Capital outlay (ETB)"
          rightValue={formatEtb(s1.capitalOutlayEtb, 0)}
          accent="cyan"
        />
      </PipelineAccordion>

      <PipelineAccordion
        stage={2}
        title="Customs Tax Waterfall"
        accent="amber"
        icon={<ShieldCheck className="h-4 w-4" />}
        kpiLabel="Total customs · official"
        kpiValue={formatEtb(s2.totalCustomsPaidEtb, 0)}
        kpiSub={`@ ${formatNumber(s2.customsOfficialRate, 0)} ETB/USD`}
        open={openStage === 2}
        onToggle={() => toggle(2)}
      >
        <DetailRow label="CIF USD/kg (×1.10)" value={formatUsd(s2.cifUsdPerKg)} />
        <DetailRow label="Total CIF USD" value={formatUsd(s2.totalCifUsd, 2)} />
        <FxConversion
          leftLabel="CIF USD total"
          leftValue={formatUsd(s2.totalCifUsd, 2)}
          rate={s2.customsOfficialRate}
          rateLabel="Official"
          rightLabel="CIF base (ETB)"
          rightValue={formatEtb(s2.cifBaseEtb, 0)}
          accent="amber"
        />
        <ul className="mt-2 space-y-0.5">
          {taxes.map((t) => (
            <li key={t.label} className="flex justify-between text-sm text-slate-400">
              <span>{t.label}</span>
              <span className="tabular-nums font-mono text-xs">{formatEtb(t.value, 0)}</span>
            </li>
          ))}
        </ul>
      </PipelineAccordion>

      <PipelineAccordion
        stage={3}
        title="Transit & Landed Cost"
        accent="emerald"
        icon={<Warehouse className="h-4 w-4" />}
        kpiLabel="Landed unit cost"
        kpiValue={`${formatNumber(s3.finalLandedUnitCostEtbPerKg, 2)} ETB/kg`}
        open={openStage === 3}
        onToggle={() => toggle(3)}
      >
        <DetailRow
          label={`Inland (${qty.toLocaleString()} × ${inputs.inlandClearancePerKgEtb})`}
          value={formatEtb(s3.inlandTransportEtb, 0)}
        />
        <DetailRow label="Gross investment" value={formatEtb(s3.grossInvestmentEtb, 0)} />
        <DetailRow label="− WHT + VAT (refundable)" value={formatEtb(s3.refundableWhtVatEtb, 0)} />
        <DetailRow label="Net landed cost" value={formatEtb(s3.netLandedCostEtb, 0)} />
      </PipelineAccordion>

      <PipelineAccordion
        stage={4}
        title="Market Strategy"
        accent="purple"
        icon={<TrendingUp className="h-4 w-4" />}
        kpiLabel="Gross margin"
        kpiValue={`${formatNumber(s4.grossMarginPct, 1)}%`}
        kpiSub={`${positive ? "+" : ""}${formatNumber(s4.profitPerKgEtb, 2)} ETB/kg`}
        open={openStage === 4}
        onToggle={() => toggle(4)}
      >
        <DetailRow
          label="Landed unit cost"
          value={`${formatNumber(s3.finalLandedUnitCostEtbPerKg, 2)} ETB/kg`}
        />
        <DetailRow
          label="Target selling price"
          value={`${formatNumber(s4.targetSellingPriceEtbPerKg, 2)} ETB/kg`}
        />
        <DetailRow
          label="Expected profit / kg"
          value={`${positive ? "+" : ""}${formatNumber(s4.profitPerKgEtb, 2)} ETB`}
        />
        <DetailRow label="Total revenue" value={formatEtb(s4.totalExpectedRevenueEtb, 0)} />
      </PipelineAccordion>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  step = "any",
  accent,
  suffix,
  compact,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  accent?: "cyan" | "amber" | "purple";
  suffix?: string;
  compact?: boolean;
}) {
  const ring =
    accent === "purple"
      ? "focus:ring-purple-500"
      : accent === "amber"
        ? "focus:ring-amber-500"
        : "focus:ring-cyan-500";

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="relative">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
          className={`w-full rounded-lg bg-slate-950 border border-white/5 text-white transition focus:outline-none focus:ring-2 ${ring} ${compact ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-sm"} ${suffix ? "pr-12" : ""}`}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">
            {suffix}
          </span>
        )}
      </div>
      {hint && <span className="text-[10px] text-slate-600 block leading-snug">{hint}</span>}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-slate-950 border border-white/5 px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </label>
  );
}

function CollapsibleInputSection({
  id,
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`section-${id}`}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[9px] font-semibold text-slate-600 uppercase">{badge}</span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && (
        <div id={`section-${id}`} className="px-3 pb-3 pt-0 space-y-2.5 border-t border-white/5">
          <div className="pt-2.5 space-y-2.5">{children}</div>
        </div>
      )}
    </div>
  );
}

function InputConsole({
  inputs,
  onChange,
}: {
  inputs: TradeTransitInputs;
  onChange: (patch: Partial<TradeTransitInputs>) => void;
}) {
  const [openSections, setOpenSections] = useState({
    origin: false,
    misc: false,
    customs: false,
  });
  const specialGoods15 = inputs.taxSpecialGoodsPct === 15;

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-4 lg:sticky lg:top-4">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80">
          Input console
        </p>
      </div>

      {/* Always-visible accountant essentials */}
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 mb-3 space-y-2.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-500/80">
          Key drivers · always visible
        </p>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Quantity"
            value={inputs.quantityKg}
            onChange={(v) => onChange({ quantityKg: v })}
            step="1"
            suffix="kg"
            compact
          />
          <NumberField
            label="Target price"
            value={inputs.targetSellingPriceEtbPerKg}
            onChange={(v) => onChange({ targetSellingPriceEtbPerKg: v })}
            step="0.01"
            suffix="ETB/kg"
            accent="purple"
            compact
          />
          <NumberField
            label="Parallel rate"
            value={inputs.capitalParallelRate}
            onChange={(v) => onChange({ capitalParallelRate: v })}
            accent="cyan"
            compact
          />
          <NumberField
            label="Official rate"
            value={inputs.customsOfficialRate}
            onChange={(v) => onChange({ customsOfficialRate: v })}
            accent="amber"
            compact
          />
        </div>
        <p className="flex items-start gap-1 text-[9px] text-amber-500/70 leading-snug">
          <Info className="h-3 w-3 shrink-0 mt-0.5" />
          Parallel → capital ETB. Official → customs taxes only.
        </p>
      </div>

      <div className="space-y-2 max-h-[min(52vh,520px)] overflow-y-auto pr-0.5">
        <CollapsibleInputSection
          id="origin"
          title="Origin & Moyale"
          badge="USD"
          open={openSections.origin}
          onToggle={() => toggleSection("origin")}
        >
          <NumberField
            label="Supplier base price"
            value={inputs.supplierBasePriceUsd}
            onChange={(v) => onChange({ supplierBasePriceUsd: v })}
            step="0.0001"
            suffix="USD/kg"
          />
          <NumberField
            label="Supplier margin"
            value={inputs.supplierMarginPct}
            onChange={(v) => onChange({ supplierMarginPct: v })}
            suffix="%"
          />
          <NumberField
            label="Transport to Moyale"
            value={inputs.transportToMoyaleUsdPerKg}
            onChange={(v) => onChange({ transportToMoyaleUsdPerKg: v })}
            step="0.0001"
            suffix="USD/kg"
          />
        </CollapsibleInputSection>

        <CollapsibleInputSection
          id="misc"
          title="Misc border fees"
          badge="USD"
          open={openSections.misc}
          onToggle={() => toggleSection("misc")}
        >
          <NumberField
            label="Amount (shipment total)"
            value={inputs.miscBorderCostUsd}
            onChange={(v) => onChange({ miscBorderCostUsd: v })}
            step="0.01"
            suffix="USD"
          />
          <TextField
            label="Reason"
            value={inputs.miscBorderReason}
            onChange={(v) => onChange({ miscBorderReason: v })}
            placeholder="e.g. Moyale storage fee"
          />
        </CollapsibleInputSection>

        <CollapsibleInputSection
          id="customs"
          title="Customs parameters"
          badge="USD"
          open={openSections.customs}
          onToggle={() => toggleSection("customs")}
        >
          <NumberField
            label="Base customs reference"
            value={inputs.baseCustomsReferenceUsd}
            onChange={(v) => onChange({ baseCustomsReferenceUsd: v })}
            step="0.0001"
            suffix="USD/kg"
          />
          <div className="flex items-center gap-2">
            <input
              id="special-goods-15"
              type="checkbox"
              checked={specialGoods15}
              onChange={(e) =>
                onChange({ taxSpecialGoodsPct: e.target.checked ? 15 : 0 })
              }
              className="rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="special-goods-15" className="text-xs text-slate-400">
              15% special goods tax
            </label>
          </div>
          <NumberField
            label="Special goods tax %"
            value={inputs.taxSpecialGoodsPct}
            onChange={(v) => onChange({ taxSpecialGoodsPct: v })}
            suffix="%"
          />
        </CollapsibleInputSection>
      </div>
    </div>
  );
}

export function ImportFinanceCalculatorPanel({
  inputs,
  onChange,
  constants = DEFAULT_FINANCE_CONSTANTS,
  compact = false,
}: ImportFinanceCalculatorPanelProps) {
  const result = useMemo(
    () => calculateTradeTransit(inputs, constants),
    [inputs, constants],
  );

  const qty = Math.max(inputs.quantityKg, 0);

  const layout = (
    <div
      className={`grid gap-5 ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]"}`}
    >
      <div className="min-w-0 order-1">
        <PipelineStack
          result={result}
          inputs={inputs}
          constants={constants}
          qty={qty}
        />
      </div>
      <div className="min-w-0 order-2">
        <InputConsole inputs={inputs} onChange={onChange} />
      </div>
    </div>
  );

  return layout;
}
