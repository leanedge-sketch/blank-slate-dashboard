import { useMemo, type ReactNode } from "react";
import {
  ArrowDown,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Truck,
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

function MetricRow({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 border-b border-slate-100 last:border-0 ${
        highlight ? "font-semibold text-slate-900" : "text-slate-700"
      }`}
    >
      <div className="min-w-0">
        <span className="text-sm">{label}</span>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <span className="text-sm tabular-nums text-right shrink-0">{value}</span>
    </div>
  );
}

function TimelineNode({
  icon,
  active,
  complete,
}: {
  icon: ReactNode;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <div
      className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-colors ${
        complete
          ? "border-indigo-600 bg-indigo-600 text-white"
          : active
            ? "border-indigo-500 bg-white text-indigo-600"
            : "border-slate-200 bg-white text-slate-400"
      }`}
    >
      {icon}
    </div>
  );
}

function StageCard({
  stage,
  title,
  location,
  icon,
  children,
  accent = "indigo",
  isLast,
}: {
  stage: number;
  title: string;
  location: string;
  icon: ReactNode;
  children: ReactNode;
  accent?: "indigo" | "amber" | "sky" | "emerald";
  isLast?: boolean;
}) {
  const accentMap = {
    indigo: "from-indigo-500/10 to-white border-indigo-200/80",
    amber: "from-amber-500/10 to-white border-amber-200/80",
    sky: "from-sky-500/10 to-white border-sky-200/80",
    emerald: "from-emerald-500/10 to-white border-emerald-200/80",
  };

  return (
    <div className="relative flex gap-4 pb-10 last:pb-0">
      <div className="flex flex-col items-center">
        <TimelineNode icon={icon} complete />
        {!isLast && (
          <div className="mt-2 flex flex-1 flex-col items-center">
            <div className="w-0.5 flex-1 min-h-[2rem] bg-gradient-to-b from-indigo-300 to-indigo-100" />
            <ArrowDown className="h-4 w-4 text-indigo-300 -mt-1" />
          </div>
        )}
      </div>

      <article
        className={`flex-1 rounded-2xl border bg-gradient-to-br p-5 shadow-sm ${accentMap[accent]}`}
      >
        <header className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Stage {stage}
          </p>
          <h3 className="text-lg font-bold text-slate-900 mt-0.5">{title}</h3>
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
        sub="Supplier base × (1 + margin %)"
        value={`${formatUsd(capital.materialCostUsdPerKg)} /kg`}
      />
      <MetricRow
        label="+ Transport to Moyale"
        value={`${formatUsd(
          capital.borderValueUsdPerKg - capital.materialCostUsdPerKg,
        )} /kg`}
      />
      <MetricRow
        label="Border value"
        sub="Material + transport"
        value={`${formatUsd(capital.borderValueUsdPerKg)} /kg`}
        highlight
      />
      <MetricRow
        label="× Quantity"
        value={`${formatNumber(qty, 0)} kg`}
      />
      <MetricRow
        label="× Parallel rate"
        value={formatUsd(capital.totalCapitalUsd, 2)}
      />
      <div className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
          Capital outlay
        </p>
        <p className="text-2xl font-bold tabular-nums mt-1">
          {formatEtb(capital.totalCapitalEtb, 0)}
        </p>
        <p className="text-xs text-indigo-200 mt-1">
          Cash deployed at the border (parallel FX)
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
        label="CIF assessed value"
        sub={`Base customs reference × ${1 + constants.freightInsuranceBufferPct} (${bufferPct}% buffer)`}
        value={`${formatUsd(customs.cifAssessedUsdPerKg)} /kg`}
      />
      <MetricRow
        label="Total CIF (USD)"
        value={formatUsd(customs.totalCifAssessedUsd, 2)}
      />
      <MetricRow
        label="× Official rate"
        sub={`${formatNumber(officialRate, 2)} ETB/USD`}
        value={formatEtb(customs.cifBaseEtb, 0)}
        highlight
      />
      <div className="mt-3 rounded-lg bg-white/70 border border-amber-100 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          Tax waterfall
        </p>
        <MetricRow
          label="Customs duty (5%)"
          value={formatEtb(customs.dutyEtb, 0)}
        />
        <MetricRow
          label="Scan fee (0.07%)"
          value={formatEtb(customs.scanFeeEtb, 0)}
        />
        <MetricRow
          label="Social fee (3%)"
          value={formatEtb(customs.socialFeeEtb, 0)}
        />
        <MetricRow label="WHT (3%)" value={formatEtb(customs.whtEtb, 0)} />
        <MetricRow label="VAT (15%)" value={formatEtb(customs.vatEtb, 0)} />
      </div>
      <div className="mt-4 rounded-xl bg-amber-600 px-4 py-3 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-100">
          Total customs paid
        </p>
        <p className="text-2xl font-bold tabular-nums mt-1">
          {formatEtb(customs.totalCustomsPaidEtb, 0)}
        </p>
      </div>
    </>
  );
}

function Stage3Output({ result, qty }: { result: ImportFinanceResult; qty: number }) {
  const { capital, customs, bottomLine } = result;

  return (
    <>
      <MetricRow
        label="Inland transport"
        sub={`${qty.toLocaleString()} kg × ${LOCAL_CLEARANCE_PER_KG_ETB} ETB/kg`}
        value={formatEtb(bottomLine.totalLocalClearanceEtb, 0)}
      />
      <MetricRow
        label="Capital outlay"
        value={formatEtb(capital.totalCapitalEtb, 0)}
      />
      <MetricRow
        label="+ Total customs"
        value={formatEtb(customs.totalCustomsPaidEtb, 0)}
      />
      <MetricRow
        label="+ Inland transport"
        value={formatEtb(bottomLine.totalLocalClearanceEtb, 0)}
      />
      <MetricRow
        label="Gross investment"
        value={formatEtb(bottomLine.grossInvestmentEtb, 0)}
        highlight
      />
      <MetricRow
        label="− Refundable WHT & VAT"
        sub="Excluded from net landed cost"
        value={formatEtb(customs.whtEtb + customs.vatEtb, 0)}
      />
      <MetricRow
        label="Net landed cost"
        value={formatEtb(bottomLine.netLandedCostEtb, 0)}
        highlight
      />
      <div className="mt-4 rounded-xl border-2 border-sky-500 bg-sky-50 px-4 py-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-700">
          Final landed unit cost in Addis
        </p>
        <p className="text-3xl font-extrabold tabular-nums text-sky-900 mt-1">
          {formatNumber(bottomLine.finalUnitCostEtbPerKg, 2)}
          <span className="text-lg font-semibold text-sky-700 ml-1">ETB/kg</span>
        </p>
      </div>
    </>
  );
}

function Stage4Output({
  result,
  qty,
}: {
  result: ImportFinanceResult;
  qty: number;
}) {
  const { sales, bottomLine } = result;
  const positive = sales.profitPerKgEtb >= 0;
  const strongMargin = sales.grossMarginPct >= 15;

  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        positive
          ? strongMargin
            ? "border-emerald-400 bg-emerald-50/80"
            : "border-emerald-300 bg-emerald-50/50"
          : "border-rose-400 bg-rose-50/80"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            positive ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900"
          }`}
        >
          Market outlook
        </span>
        <span className="text-xs text-slate-500">CRM connect</span>
      </div>

      <MetricRow
        label="Target selling price"
        value={`${formatNumber(sales.targetSellingPriceEtbPerKg, 2)} ETB/kg`}
      />
      <MetricRow
        label="Final landed unit cost"
        value={`${formatNumber(bottomLine.finalUnitCostEtbPerKg, 2)} ETB/kg`}
      />
      <MetricRow
        label="Expected profit per kg"
        value={`${positive ? "+" : ""}${formatNumber(sales.profitPerKgEtb, 2)} ETB`}
        highlight
      />
      <MetricRow
        label="Gross margin"
        value={`${formatNumber(sales.grossMarginPct, 1)}%`}
        highlight
      />

      <div
        className={`mt-4 rounded-xl px-4 py-4 text-center ${
          positive ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
          Total expected revenue
        </p>
        <p className="text-2xl font-bold tabular-nums mt-1">
          {formatEtb(sales.totalExpectedRevenueEtb, 0)}
        </p>
        <p className="text-xs opacity-80 mt-1">
          {formatNumber(sales.targetSellingPriceEtbPerKg, 2)} ETB/kg ×{" "}
          {qty.toLocaleString()} kg
        </p>
      </div>

      {!positive && (
        <p className="mt-3 text-xs text-rose-700 font-medium text-center">
          Selling below landed cost — adjust price or renegotiate supplier terms.
        </p>
      )}
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
  accent?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span
        className={`text-xs font-medium ${accent ? "text-emerald-700" : "text-slate-600"}`}
      >
        {label}
      </span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 ${
          accent
            ? "border-emerald-300 focus:ring-emerald-500"
            : "border-slate-300 focus:ring-indigo-500"
        }`}
      />
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
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
      className={`grid gap-8 ${
        compact ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[minmax(280px,340px)_1fr]"
      }`}
    >
      {/* Left: sticky inputs */}
      <aside className="xl:sticky xl:top-4 self-start space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Journey inputs
          </p>
          <h3 className="text-base font-bold text-slate-900 mt-1">
            Origin → Moyale → Addis
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Adjust any value — the pipeline updates instantly.
          </p>

          <div className="space-y-3">
            <InputField
              label="Quantity (kg)"
              value={inputs.quantityKg}
              onChange={(v) => onChange({ quantityKg: v })}
              step="1"
            />
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
              label="Official exchange rate (ETB/USD)"
              value={inputs.officialRate}
              onChange={(v) => onChange({ officialRate: v })}
            />
            <InputField
              label="Parallel exchange rate (ETB/USD)"
              value={inputs.parallelRate}
              onChange={(v) => onChange({ parallelRate: v })}
            />
            <InputField
              label="Base customs reference (USD/kg)"
              value={inputs.baseCustomsReferenceUsd}
              onChange={(v) => onChange({ baseCustomsReferenceUsd: v })}
              step="0.0001"
            />
            <InputField
              label="Target selling price per kg (ETB)"
              hint="Used for margin & CRM outlook"
              value={inputs.targetSellingPriceEtbPerKg}
              onChange={(v) => onChange({ targetSellingPriceEtbPerKg: v })}
              step="0.01"
              accent
            />
          </div>

          <p className="mt-4 text-[11px] text-slate-400 border-t border-slate-100 pt-3">
            Inland clearance fixed at {LOCAL_CLEARANCE_PER_KG_ETB} ETB/kg (Moyale
            → Addis Ababa warehouse).
          </p>
        </div>
      </aside>

      {/* Right: vertical pipeline story */}
      <div className="min-w-0">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">
            Supply chain pipeline
          </p>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Shipment journey & landed cost
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Follow the goods from supplier origin through Moyale customs to your
            Addis Ababa warehouse.
          </p>
        </div>

        <StageCard
          stage={1}
          title="Arrival at Moyale Border"
          location="Ethiopia–Kenya border · Southern corridor"
          icon={<MapPin className="h-5 w-5" />}
          accent="indigo"
        >
          <Stage1Output result={result} qty={qty} />
        </StageCard>

        <StageCard
          stage={2}
          title="Customs Clearance"
          location="Moyale customs · Assessed value & duties"
          icon={<ShieldCheck className="h-5 w-5" />}
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
          title="Transit: Moyale → Addis Ababa"
          location="Inland haul to warehouse"
          icon={<Truck className="h-5 w-5" />}
          accent="sky"
        >
          <Stage3Output result={result} qty={qty} />
        </StageCard>

        <StageCard
          stage={4}
          title="Sales & Margin"
          location="Addis Ababa warehouse · CRM pricing"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="emerald"
          isLast
        >
          <Stage4Output result={result} qty={qty} />
        </StageCard>
      </div>
    </div>
  );
}
