import { useMemo, type ReactNode } from "react";
import {
  CircleDollarSign,
  Info,
  MapPin,
  ShieldCheck,
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
/** @deprecated Use DEFAULT_TRADE_TRANSIT_INPUTS */
export const DEFAULT_IMPORT_FINANCE_INPUTS = DEFAULT_TRADE_TRANSIT_INPUTS;

type ImportFinanceCalculatorPanelProps = {
  inputs: TradeTransitInputs;
  onChange: (patch: Partial<TradeTransitInputs>) => void;
  constants?: FinanceConstants;
  compact?: boolean;
};

type Accent = "cyan" | "amber" | "emerald" | "purple";

const accentRing: Record<Accent, string> = {
  cyan: "hover:border-cyan-500/25",
  amber: "hover:border-amber-500/25",
  emerald: "hover:border-emerald-500/25",
  purple: "hover:border-purple-500/25",
};

const accentTitle: Record<Accent, string> = {
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
  purple: "text-purple-400",
};

const accentIcon: Record<Accent, string> = {
  cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function BentoCard({
  stage,
  title,
  icon,
  accent,
  children,
  kpi,
}: {
  stage: number;
  title: string;
  icon: ReactNode;
  accent: Accent;
  children: ReactNode;
  kpi: ReactNode;
}) {
  return (
    <article
      className={`bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col justify-between min-h-[240px] hover:border-white/20 transition-all ${accentRing[accent]}`}
    >
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${accentIcon[accent]}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Stage {stage}
            </p>
            <h3 className={`text-sm font-bold leading-snug ${accentTitle[accent]}`}>
              {title}
            </h3>
          </div>
        </div>
        {children}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5">{kpi}</div>
    </article>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span
        className={`text-slate-300 shrink-0 text-right ${mono ? "tabular-nums font-mono text-[11px]" : "tabular-nums"}`}
      >
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
    <div className="my-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">{leftLabel}</span>
        <span className="font-mono tabular-nums text-slate-300">{leftValue}</span>
      </div>
      <div className="flex items-center justify-center gap-2 py-0.5">
        <span className="text-slate-600 text-[10px]">×</span>
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${rateColor}`}
        >
          {rateLabel} {formatNumber(rate, 2)}
        </span>
        <span className="text-slate-600 text-[10px]">=</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${accentTitle[accent]}`}>
          {rightLabel}
        </span>
        <span
          className={`text-sm font-bold tabular-nums ${accentTitle[accent]}`}
        >
          {rightValue}
        </span>
      </div>
    </div>
  );
}

function Stage1Bento({
  result,
  qty,
}: {
  result: TradeTransitResult;
  qty: number;
}) {
  const s = result.stage1;
  return (
    <BentoCard
      stage={1}
      title="Origin & Border Outlay"
      accent="cyan"
      icon={<MapPin className="h-4 w-4" />}
      kpi={
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500/70 mb-1">
            Capital outlay (ETB) · parallel FX
          </p>
          <p className="text-3xl font-bold tabular-nums text-cyan-300 leading-none">
            {formatEtb(s.capitalOutlayEtb, 0)}
          </p>
        </div>
      }
    >
      <DetailRow
        label="Material USD/kg"
        value={formatUsd(s.materialUsdPerKg)}
        mono
      />
      <DetailRow
        label="+ Transport USD/kg"
        value={formatUsd(s.transportUsdPerKg)}
        mono
      />
      {s.miscBorderUsdTotal > 0 && (
        <DetailRow
          label="+ Misc border (total USD)"
          value={formatUsd(s.miscBorderUsdTotal, 2)}
          mono
        />
      )}
      <DetailRow
        label={`Border × ${formatNumber(qty, 0)} kg`}
        value={formatUsd(s.totalBorderUsd, 2)}
        mono
      />
      <FxConversion
        leftLabel="USD border total"
        leftValue={formatUsd(s.totalBorderUsd, 2)}
        rate={s.capitalParallelRate}
        rateLabel="Capital / parallel"
        rightLabel="Capital outlay (ETB)"
        rightValue={formatEtb(s.capitalOutlayEtb, 0)}
        accent="cyan"
      />
    </BentoCard>
  );
}

function Stage2Bento({
  result,
  constants,
  specialGoodsPct,
}: {
  result: TradeTransitResult;
  constants: FinanceConstants;
  specialGoodsPct: number;
}) {
  const s = result.stage2;
  const taxes = [
    {
      label: `Duty (${(constants.customsDutyPct * 100).toFixed(0)}%)`,
      value: s.dutyEtb,
    },
    {
      label: `Scan (${(constants.scanFeePct * 100).toFixed(2)}%)`,
      value: s.scanFeeEtb,
    },
    {
      label: `Social (${(constants.socialFeePct * 100).toFixed(0)}%)`,
      value: s.socialFeeEtb,
    },
    {
      label: `Special goods (${specialGoodsPct.toFixed(0)}%)`,
      value: s.specialGoodsEtb,
    },
    {
      label: `WHT (${(constants.whtPct * 100).toFixed(0)}%)`,
      value: s.whtEtb,
    },
    {
      label: `VAT (${(constants.vatPct * 100).toFixed(0)}%)`,
      value: s.vatEtb,
    },
    { label: "Surtax (0%)", value: s.surtaxEtb },
    { label: "Excise (0%)", value: s.exciseEtb },
  ];

  return (
    <BentoCard
      stage={2}
      title="Customs Tax Waterfall"
      accent="amber"
      icon={<ShieldCheck className="h-4 w-4" />}
      kpi={
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/70 mb-1">
            Total customs paid (ETB)
          </p>
          <p className="text-3xl font-bold tabular-nums text-amber-300 leading-none">
            {formatEtb(s.totalCustomsPaidEtb, 0)}
          </p>
        </div>
      }
    >
      <DetailRow
        label="CIF USD (ref × 1.10) /kg"
        value={formatUsd(s.cifUsdPerKg)}
        mono
      />
      <DetailRow
        label="Total CIF USD"
        value={formatUsd(s.totalCifUsd, 2)}
        mono
      />
      <FxConversion
        leftLabel="CIF USD total"
        leftValue={formatUsd(s.totalCifUsd, 2)}
        rate={s.customsOfficialRate}
        rateLabel="Official"
        rightLabel="CIF base (ETB)"
        rightValue={formatEtb(s.cifBaseEtb, 0)}
        accent="amber"
      />
      <p className="text-[10px] uppercase tracking-wider text-slate-600 mt-2 mb-1">
        Off CIF base (ETB) · official rate only
      </p>
      <ul className="space-y-0.5">
        {taxes.map((t) => (
          <li
            key={t.label}
            className="flex justify-between gap-2 text-sm text-slate-400"
          >
            <span>{t.label}</span>
            <span className="tabular-nums font-mono text-xs">
              {formatEtb(t.value, 0)}
            </span>
          </li>
        ))}
      </ul>
    </BentoCard>
  );
}

function Stage3Bento({
  result,
  qty,
  inlandPerKg,
}: {
  result: TradeTransitResult;
  qty: number;
  inlandPerKg: number;
}) {
  const s = result.stage3;
  return (
    <BentoCard
      stage={3}
      title="Transit & Landed Cost"
      accent="emerald"
      icon={<Warehouse className="h-4 w-4" />}
      kpi={
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 shadow-[0_0_24px_rgba(16,185,129,0.15)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Final landed unit cost (ETB/kg)
          </p>
          <p className="text-3xl font-bold tabular-nums text-emerald-300 mt-1 leading-none">
            {formatNumber(s.finalLandedUnitCostEtbPerKg, 2)}
          </p>
        </div>
      }
    >
      <DetailRow
        label={`Inland ETB (${formatNumber(qty, 0)} kg × ${inlandPerKg})`}
        value={formatEtb(s.inlandTransportEtb, 0)}
        mono
      />
      <DetailRow
        label="Gross investment (ETB)"
        value={formatEtb(s.grossInvestmentEtb, 0)}
        mono
      />
      <DetailRow
        label="− Refundable WHT + VAT (ETB)"
        value={formatEtb(s.refundableWhtVatEtb, 0)}
        mono
      />
      <DetailRow
        label="Net landed cost (ETB)"
        value={formatEtb(s.netLandedCostEtb, 0)}
        mono
      />
    </BentoCard>
  );
}

function Stage4Bento({ result }: { result: TradeTransitResult }) {
  const s = result.stage4;
  const landed = result.stage3.finalLandedUnitCostEtbPerKg;
  const positive = s.profitPerKgEtb >= 0;

  return (
    <BentoCard
      stage={4}
      title="Market Strategy"
      accent="purple"
      icon={<TrendingUp className="h-4 w-4" />}
      kpi={
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Expected profit / kg (ETB)
            </p>
            <p
              className={`text-2xl font-bold tabular-nums leading-none ${positive ? "text-emerald-400" : "text-rose-400"}`}
            >
              {positive ? "+" : ""}
              {formatNumber(s.profitPerKgEtb, 2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Gross margin %
            </p>
            <p
              className={`text-2xl font-bold tabular-nums leading-none ${positive ? "text-purple-300" : "text-rose-400"}`}
            >
              {formatNumber(s.grossMarginPct, 1)}%
            </p>
          </div>
        </div>
      }
    >
      <DetailRow
        label="Net landed unit cost (ETB/kg)"
        value={formatNumber(landed, 2)}
        mono
      />
      <DetailRow
        label="Target selling price (ETB/kg)"
        value={formatNumber(s.targetSellingPriceEtbPerKg, 2)}
        mono
      />
      <DetailRow
        label="Total expected revenue (ETB)"
        value={formatEtb(s.totalExpectedRevenueEtb, 0)}
        mono
      />
    </BentoCard>
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
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  accent?: "cyan" | "amber" | "purple";
  suffix?: string;
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
          className={`w-full rounded-lg bg-slate-900 border border-transparent px-3 py-2 text-sm text-white transition focus:outline-none focus:ring-2 ${ring} ${suffix ? "pr-14" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
            {suffix}
          </span>
        )}
      </div>
      {hint && <span className="text-[10px] text-slate-600 leading-snug block">{hint}</span>}
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
        className="w-full rounded-lg bg-slate-900 border border-transparent px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </label>
  );
}

function InputGroup({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5 rounded-lg border border-white/5 bg-black/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
          {title}
        </p>
        {badge && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function CommandConsole({
  inputs,
  onChange,
}: {
  inputs: TradeTransitInputs;
  onChange: (patch: Partial<TradeTransitInputs>) => void;
}) {
  const specialGoods15 = inputs.taxSpecialGoodsPct === 15;

  return (
    <aside className="lg:sticky lg:top-4 self-start">
      <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-4">
        <div className="flex items-center gap-2 mb-4">
          <CircleDollarSign className="h-4 w-4 text-cyan-400" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80">
            Input command console
          </p>
        </div>

        <div className="space-y-3">
          <InputGroup title="Group A · Shipment details">
            <NumberField
              label="Quantity (kg)"
              value={inputs.quantityKg}
              onChange={(v) => onChange({ quantityKg: v })}
              step="1"
            />
            <NumberField
              label="Target selling price (ETB/kg)"
              value={inputs.targetSellingPriceEtbPerKg}
              onChange={(v) => onChange({ targetSellingPriceEtbPerKg: v })}
              step="0.01"
              accent="purple"
              suffix="ETB/kg"
            />
          </InputGroup>

          <InputGroup title="Group B · Origin & Moyale" badge="USD">
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
          </InputGroup>

          <InputGroup title="Group C · Misc border additions" badge="USD">
            <NumberField
              label="Amount (total shipment)"
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
          </InputGroup>

          <InputGroup title="Group D · Exchange rates" badge="ETB/USD">
            <NumberField
              label="Capital / parallel rate"
              hint="Applied to USD border total → capital outlay (ETB)"
              value={inputs.capitalParallelRate}
              onChange={(v) => onChange({ capitalParallelRate: v })}
              accent="cyan"
            />
            <NumberField
              label="Customs official rate"
              hint="Locked for CIF base and all customs taxes (ETB)"
              value={inputs.customsOfficialRate}
              onChange={(v) => onChange({ customsOfficialRate: v })}
              accent="amber"
            />
            <p className="flex items-start gap-1.5 text-[10px] text-amber-500/80 leading-snug">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Official rate is used exclusively for customs assessment and tax
              waterfall. Capital purchases use the parallel rate.
            </p>
          </InputGroup>

          <InputGroup title="Group E · Customs parameters" badge="USD">
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
                  onChange({
                    taxSpecialGoodsPct: e.target.checked ? 15 : 0,
                  })
                }
                className="rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              />
              <label
                htmlFor="special-goods-15"
                className="text-xs text-slate-400"
              >
                Apply 15% special goods tax
              </label>
            </div>
            <NumberField
              label="Special goods tax %"
              value={inputs.taxSpecialGoodsPct}
              onChange={(v) => onChange({ taxSpecialGoodsPct: v })}
              step="0.01"
              suffix="%"
            />
          </InputGroup>
        </div>
      </div>
    </aside>
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

  const bentoGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Stage1Bento result={result} qty={qty} />
      <Stage2Bento
        result={result}
        constants={constants}
        specialGoodsPct={inputs.taxSpecialGoodsPct}
      />
      <Stage3Bento
        result={result}
        qty={qty}
        inlandPerKg={inputs.inlandClearancePerKgEtb}
      />
      <Stage4Bento result={result} />
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-6">
        <CommandConsole inputs={inputs} onChange={onChange} />
        {bentoGrid}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-3">
        <CommandConsole inputs={inputs} onChange={onChange} />
      </div>
      <div className="lg:col-span-9 min-w-0">{bentoGrid}</div>
    </div>
  );
}
