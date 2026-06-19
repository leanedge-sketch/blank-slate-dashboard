import { useMemo, type ReactNode } from "react";
import {
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  calculateImportFinance,
  formatEtb,
  formatNumber,
  formatUsd,
  LOCAL_CLEARANCE_PER_KG_ETB,
  type FinanceConstants,
  type ImportFinanceInputs,
  type ImportFinanceResult,
  DEFAULT_FINANCE_CONSTANTS,
} from "../../utils/importFinanceCalc";

export const DEFAULT_IMPORT_FINANCE_INPUTS: ImportFinanceInputs = {
  quantityKg: 20000,
  officialRate: 156,
  parallelRate: 190,
  supplierBasePriceUsd: 0.9,
  supplierMarginPct: 10,
  transportToBorderUsdPerKg: 0.14,
  baseCustomsReferenceUsd: 0.792,
  targetSellingPriceEtbPerKg: 185,
};

type ImportFinanceCalculatorPanelProps = {
  inputs: ImportFinanceInputs;
  onChange: (patch: Partial<ImportFinanceInputs>) => void;
  constants?: FinanceConstants;
  compact?: boolean;
};

type Accent = "cyan" | "amber" | "emerald" | "purple";

const accentStyles: Record<
  Accent,
  { icon: string; title: string; glow: string; badge: string }
> = {
  cyan: {
    icon: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    title: "text-cyan-300",
    glow: "shadow-[0_0_24px_rgba(6,182,212,0.12)]",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  },
  amber: {
    icon: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    title: "text-amber-300",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.1)]",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  },
  emerald: {
    icon: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    title: "text-emerald-300",
    glow: "shadow-[0_0_28px_rgba(16,185,129,0.18)]",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  },
  purple: {
    icon: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    title: "text-purple-300",
    glow: "shadow-[0_0_24px_rgba(168,85,247,0.12)]",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/25",
  },
};

function MetricRow({
  label,
  value,
  sub,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  accent?: Accent;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2.5 border-b border-white/5 last:border-0 ${
        highlight ? "text-slate-100" : "text-slate-400"
      }`}
    >
      <div className="min-w-0">
        <span className={`text-sm ${highlight ? "font-medium text-slate-200" : ""}`}>
          {label}
        </span>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <span
        className={`text-sm tabular-nums text-right shrink-0 ${
          highlight && accent ? accentStyles[accent].title : "text-slate-200"
        } ${highlight ? "font-semibold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function StageCard({
  stage,
  title,
  location,
  icon,
  children,
  accent,
  isLast,
}: {
  stage: number;
  title: string;
  location: string;
  icon: ReactNode;
  children: ReactNode;
  accent: Accent;
  isLast?: boolean;
}) {
  const styles = accentStyles[accent];

  return (
    <div className={`relative mb-6 last:mb-0 pl-10 ${!isLast ? "pb-2" : ""}`}>
      <div
        className={`absolute left-0 top-6 z-10 flex h-8 w-8 items-center justify-center rounded-full border ${styles.icon}`}
      >
        {icon}
      </div>

      <article
        className={`bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-xl relative ${styles.glow}`}
      >
        <header className="mb-4">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${styles.badge}`}
          >
            Stage {stage}
          </span>
          <h3 className={`text-lg font-bold mt-2 ${styles.title}`}>{title}</h3>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {location}
          </p>
        </header>
        {children}
      </article>
    </div>
  );
}

function Stage1Output({ result, qty }: { result: ImportFinanceResult; qty: number }) {
  const { capital } = result;
  return (
    <>
      <MetricRow
        label="Material cost"
        sub="Base price × (1 + margin %)"
        value={`${formatUsd(capital.materialCostUsdPerKg)} /kg`}
      />
      <MetricRow
        label="+ Transport to Moyale"
        value={`${formatUsd(
          capital.borderValueUsdPerKg - capital.materialCostUsdPerKg,
        )} /kg`}
      />
      <MetricRow
        label="Border value (USD)"
        sub="Material + transport"
        value={`${formatUsd(capital.borderValueUsdPerKg)} /kg`}
        highlight
        accent="cyan"
      />
      <MetricRow label="× Quantity" value={`${formatNumber(qty, 0)} kg`} />
      <MetricRow
        label="× Parallel rate"
        value={formatUsd(capital.totalCapitalUsd, 2)}
      />
      <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80">
          Capital outlay (ETB)
        </p>
        <p className="text-2xl font-bold tabular-nums text-cyan-300 mt-1">
          {formatEtb(capital.totalCapitalEtb, 0)}
        </p>
      </div>
    </>
  );
}

function Stage2Output({
  result,
  constants,
  officialRate,
}: {
  result: ImportFinanceResult;
  constants: FinanceConstants;
  officialRate: number;
}) {
  const { customs } = result;
  const bufferPct = Math.round(constants.freightInsuranceBufferPct * 100);

  return (
    <>
      <MetricRow
        label="CIF assessed value (USD)"
        sub={`Base customs reference × 1.10 (${bufferPct}% buffer)`}
        value={`${formatUsd(customs.cifAssessedUsdPerKg)} /kg`}
      />
      <MetricRow
        label="× Official rate"
        sub={`${formatNumber(officialRate, 2)} ETB/USD`}
        value={formatEtb(customs.cifBaseEtb, 0)}
        highlight
        accent="amber"
      />
      <div className="mt-3 rounded-lg bg-black/20 border border-amber-500/15 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-1">
          Tax waterfall
        </p>
        <MetricRow label="Duty (5%)" value={formatEtb(customs.dutyEtb, 0)} />
        <MetricRow label="Scan (0.07%)" value={formatEtb(customs.scanFeeEtb, 0)} />
        <MetricRow label="Social (3%)" value={formatEtb(customs.socialFeeEtb, 0)} />
        <MetricRow label="WHT (3%)" value={formatEtb(customs.whtEtb, 0)} />
        <MetricRow label="VAT (15%)" value={formatEtb(customs.vatEtb, 0)} />
      </div>
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
          Total customs paid
        </p>
        <p className="text-2xl font-bold tabular-nums text-amber-300 mt-1">
          {formatEtb(customs.totalCustomsPaidEtb, 0)}
        </p>
      </div>
    </>
  );
}

function Stage3Output({ result, qty }: { result: ImportFinanceResult; qty: number }) {
  const { customs, bottomLine } = result;

  return (
    <>
      <MetricRow
        label="Inland transport"
        sub={`${qty.toLocaleString()} kg × ${LOCAL_CLEARANCE_PER_KG_ETB} ETB/kg`}
        value={formatEtb(bottomLine.totalLocalClearanceEtb, 0)}
      />
      <MetricRow
        label="Gross investment"
        sub="Capital + customs + inland"
        value={formatEtb(bottomLine.grossInvestmentEtb, 0)}
        highlight
        accent="emerald"
      />
      <MetricRow
        label="− Refundable WHT & VAT"
        value={formatEtb(customs.whtEtb + customs.vatEtb, 0)}
      />
      <MetricRow
        label="Net landed cost"
        value={formatEtb(bottomLine.netLandedCostEtb, 0)}
        highlight
      />
      <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-5 text-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
          Final landed unit cost (ETB/kg)
        </p>
        <p className="text-2xl font-bold tabular-nums text-emerald-300 mt-2">
          {formatNumber(bottomLine.finalUnitCostEtbPerKg, 2)}
          <span className="text-base font-semibold text-emerald-400/80 ml-1">
            ETB/kg
          </span>
        </p>
        <p className="text-xs text-emerald-500/70 mt-1">Addis Ababa warehouse</p>
      </div>
    </>
  );
}

function Stage4Output({ result }: { result: ImportFinanceResult }) {
  const { sales, bottomLine } = result;
  const positive = sales.profitPerKgEtb >= 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        positive
          ? "border-purple-500/30 bg-purple-500/5"
          : "border-rose-500/40 bg-rose-500/10"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className={`h-4 w-4 ${positive ? "text-purple-400" : "text-rose-400"}`} />
        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${
            positive ? "text-purple-300" : "text-rose-300"
          }`}
        >
          Market strategy
        </span>
      </div>

      <MetricRow
        label="Target selling price"
        value={`${formatNumber(sales.targetSellingPriceEtbPerKg, 2)} ETB/kg`}
      />
      <MetricRow
        label="Landed unit cost"
        value={`${formatNumber(bottomLine.finalUnitCostEtbPerKg, 2)} ETB/kg`}
      />
      <MetricRow
        label="Expected profit per kg"
        value={`${positive ? "+" : ""}${formatNumber(sales.profitPerKgEtb, 2)} ETB`}
        highlight
        accent="purple"
      />
      <MetricRow
        label="Gross margin %"
        value={`${formatNumber(sales.grossMarginPct, 1)}%`}
        highlight
        accent={positive ? "purple" : undefined}
      />

      <div
        className={`mt-4 rounded-xl px-4 py-4 text-center border ${
          positive
            ? "border-purple-500/30 bg-purple-600/20"
            : "border-rose-500/40 bg-rose-600/20"
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Total expected revenue
        </p>
        <p
          className={`text-2xl font-bold tabular-nums mt-1 ${
            positive ? "text-purple-200" : "text-rose-300"
          }`}
        >
          {formatEtb(sales.totalExpectedRevenueEtb, 0)}
        </p>
      </div>
    </div>
  );
}

function InputField({
  label,
  hint,
  value,
  onChange,
  step = "any",
  accent,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  accent?: "cyan" | "purple";
}) {
  const ring =
    accent === "purple"
      ? "focus:ring-purple-500"
      : accent === "cyan"
        ? "focus:ring-cyan-500"
        : "focus:ring-cyan-500";
  const labelColor =
    accent === "purple" ? "text-purple-300" : "text-slate-400";

  return (
    <label className="block space-y-1.5">
      <span className={`text-xs font-medium ${labelColor}`}>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
        className={`w-full rounded-lg bg-slate-900 border border-transparent px-3 py-2.5 text-sm text-white placeholder:text-slate-600 transition focus:outline-none focus:ring-2 ${ring}`}
      />
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function InputGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      {children}
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
    () => calculateImportFinance(inputs, constants),
    [inputs, constants],
  );

  const qty = Math.max(inputs.quantityKg, 0);

  return (
    <div
      className={`grid gap-8 lg:gap-10 ${
        compact
          ? "grid-cols-1"
          : "grid-cols-1 lg:grid-cols-[minmax(280px,320px)_1fr]"
      }`}
    >
      {/* Command console */}
      <aside className="lg:sticky lg:top-6 self-start">
        <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80">
            Command console
          </p>
          <h3 className="text-base font-bold text-white mt-1">Journey variables</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Origin → Moyale → Addis — updates in real time.
          </p>

          <div className="space-y-5">
            <InputGroup title="Shipment">
              <InputField
                label="Quantity (kg)"
                value={inputs.quantityKg}
                onChange={(v) => onChange({ quantityKg: v })}
                step="1"
              />
            </InputGroup>

            <InputGroup title="Supplier & border">
              <InputField
                label="Supplier base price (USD/kg)"
                value={inputs.supplierBasePriceUsd}
                onChange={(v) => onChange({ supplierBasePriceUsd: v })}
                step="0.0001"
              />
              <InputField
                label="Supplier margin (%)"
                value={inputs.supplierMarginPct}
                onChange={(v) => onChange({ supplierMarginPct: v })}
              />
              <InputField
                label="Transport to Moyale (USD/kg)"
                value={inputs.transportToBorderUsdPerKg}
                onChange={(v) => onChange({ transportToBorderUsdPerKg: v })}
                step="0.0001"
              />
              <InputField
                label="Base customs reference (USD/kg)"
                value={inputs.baseCustomsReferenceUsd}
                onChange={(v) => onChange({ baseCustomsReferenceUsd: v })}
                step="0.0001"
              />
            </InputGroup>

            <InputGroup title="Exchange rates">
              <InputField
                label="Official rate (ETB/USD)"
                value={inputs.officialRate}
                onChange={(v) => onChange({ officialRate: v })}
                accent="cyan"
              />
              <InputField
                label="Parallel rate (ETB/USD)"
                value={inputs.parallelRate}
                onChange={(v) => onChange({ parallelRate: v })}
                accent="cyan"
              />
            </InputGroup>

            <InputGroup title="Market strategy">
              <InputField
                label="Target selling price per kg (ETB)"
                hint="Margin outlook vs landed cost"
                value={inputs.targetSellingPriceEtbPerKg}
                onChange={(v) => onChange({ targetSellingPriceEtbPerKg: v })}
                step="0.01"
                accent="purple"
              />
            </InputGroup>
          </div>

          <p className="mt-5 text-[11px] text-slate-600 border-t border-white/5 pt-4">
            Inland haul fixed at {LOCAL_CLEARANCE_PER_KG_ETB} ETB/kg (Moyale →
            Addis warehouse).
          </p>
        </div>
      </aside>

      {/* Journey timeline */}
      <div className="min-w-0 relative">
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/70">
            Journey timeline
          </p>
          <h2 className="text-xl font-bold text-white mt-1">Procurement pipeline</h2>
          <p className="text-sm text-slate-500 mt-1">
            Physical movement of goods — all stages visible simultaneously.
          </p>
        </div>

        <div className="relative">
          <div
            className="absolute left-4 top-4 bottom-4 w-px bg-gradient-to-b from-cyan-500/40 via-amber-500/30 via-emerald-500/30 to-purple-500/40"
            aria-hidden
          />

          <StageCard
            stage={1}
            title="Arrival at Moyale Border"
            location="Ethiopia–Kenya corridor"
            icon={<MapPin className="h-4 w-4" />}
            accent="cyan"
          >
            <Stage1Output result={result} qty={qty} />
          </StageCard>

          <StageCard
            stage={2}
            title="Customs Clearance"
            location="Moyale customs · assessed duties"
            icon={<ShieldCheck className="h-4 w-4" />}
            accent="amber"
          >
            <Stage2Output
              result={result}
              constants={constants}
              officialRate={inputs.officialRate}
            />
          </StageCard>

          <StageCard
            stage={3}
            title="Addis Ababa Warehouse"
            location="Inland transit complete"
            icon={<Warehouse className="h-4 w-4" />}
            accent="emerald"
          >
            <Stage3Output result={result} qty={qty} />
          </StageCard>

          <StageCard
            stage={4}
            title="Market Strategy"
            location="CRM pricing outlook"
            icon={<TrendingUp className="h-4 w-4" />}
            accent="purple"
            isLast
          >
            <Stage4Output result={result} />
          </StageCard>
        </div>
      </div>
    </div>
  );
}
