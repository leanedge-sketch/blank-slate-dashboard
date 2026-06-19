import { useMemo, type ReactNode } from "react";
import {
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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
      className={`bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col justify-between min-h-[220px] hover:border-white/20 transition-all ${accentRing[accent]}`}
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
            <h3 className={`text-sm font-bold truncate ${accentTitle[accent]}`}>
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

function CompactLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs text-slate-500 py-0.5">
      <span className="truncate">{label}</span>
      <span className="tabular-nums text-slate-400 shrink-0">{value}</span>
    </div>
  );
}

function MoyaleBento({
  result,
  qty,
}: {
  result: ImportFinanceResult;
  qty: number;
}) {
  const { capital } = result;
  const transportUsd =
    capital.borderValueUsdPerKg - capital.materialCostUsdPerKg;

  return (
    <BentoCard
      stage={1}
      title="Moyale Border"
      accent="cyan"
      icon={<MapPin className="h-4 w-4" />}
      kpi={
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500/70 mb-1">
            Capital outlay (ETB)
          </p>
          <p className="text-2xl font-bold tabular-nums text-cyan-300 leading-none">
            {formatEtb(capital.totalCapitalEtb, 0)}
          </p>
        </div>
      }
    >
      <div className="space-y-0.5">
        <CompactLine
          label="Material × (1 + margin)"
          value={`${formatUsd(capital.materialCostUsdPerKg)}/kg`}
        />
        <CompactLine
          label="+ Transport Moyale"
          value={`${formatUsd(transportUsd)}/kg`}
        />
        <CompactLine
          label="Border value"
          value={`${formatUsd(capital.borderValueUsdPerKg)}/kg`}
        />
        <CompactLine
          label={`${formatNumber(qty, 0)} kg × parallel`}
          value={formatUsd(capital.totalCapitalUsd, 2)}
        />
      </div>
    </BentoCard>
  );
}

function CustomsBento({
  result,
  constants,
}: {
  result: ImportFinanceResult;
  constants: FinanceConstants;
}) {
  const { customs } = result;
  const taxes = [
    { label: "Duty 5%", value: customs.dutyEtb },
    { label: "Scan 0.07%", value: customs.scanFeeEtb },
    { label: "Social 3%", value: customs.socialFeeEtb },
    { label: "WHT 3%", value: customs.whtEtb },
    { label: "VAT 15%", value: customs.vatEtb },
  ];

  return (
    <BentoCard
      stage={2}
      title="Customs Clearance"
      accent="amber"
      icon={<ShieldCheck className="h-4 w-4" />}
      kpi={
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/70 mb-1">
            Total customs paid
          </p>
          <p className="text-2xl font-bold tabular-nums text-amber-300 leading-none">
            {formatEtb(customs.totalCustomsPaidEtb, 0)}
          </p>
        </div>
      }
    >
      <CompactLine
        label={`CIF × ${1 + constants.freightInsuranceBufferPct} assessed`}
        value={formatEtb(customs.cifBaseEtb, 0)}
      />
      <ul className="mt-2 space-y-0.5">
        {taxes.map((t) => (
          <li
            key={t.label}
            className="flex justify-between gap-2 text-sm text-slate-400"
          >
            <span>{t.label}</span>
            <span className="tabular-nums">{formatEtb(t.value, 0)}</span>
          </li>
        ))}
      </ul>
    </BentoCard>
  );
}

function LandedBento({
  result,
  qty,
}: {
  result: ImportFinanceResult;
  qty: number;
}) {
  const { bottomLine } = result;

  return (
    <BentoCard
      stage={3}
      title="Addis Landed Cost"
      accent="emerald"
      icon={<Warehouse className="h-4 w-4" />}
      kpi={
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90">
            Final landed unit cost (ETB/kg)
          </p>
          <p className="text-2xl font-bold tabular-nums text-emerald-300 mt-1 leading-none">
            {formatNumber(bottomLine.finalUnitCostEtbPerKg, 2)}
          </p>
        </div>
      }
    >
      <CompactLine
        label={`Inland ${qty.toLocaleString()} kg × ${LOCAL_CLEARANCE_PER_KG_ETB}`}
        value={formatEtb(bottomLine.totalLocalClearanceEtb, 0)}
      />
      <CompactLine
        label="Gross investment"
        value={formatEtb(bottomLine.grossInvestmentEtb, 0)}
      />
      <CompactLine
        label="Net landed (excl. WHT/VAT)"
        value={formatEtb(bottomLine.netLandedCostEtb, 0)}
      />
    </BentoCard>
  );
}

function MarketBento({ result }: { result: ImportFinanceResult }) {
  const { sales, bottomLine } = result;
  const positive = sales.profitPerKgEtb >= 0;
  const marginColor = positive ? "text-purple-300" : "text-rose-400";
  const profitColor = positive ? "text-emerald-400" : "text-rose-400";

  return (
    <BentoCard
      stage={4}
      title="Market Strategy"
      accent="purple"
      icon={<TrendingUp className="h-4 w-4" />}
      kpi={
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
              Profit / kg
            </p>
            <p className={`text-xl font-bold tabular-nums leading-none ${profitColor}`}>
              {positive ? "+" : ""}
              {formatNumber(sales.profitPerKgEtb, 2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
              Gross margin
            </p>
            <p className={`text-xl font-bold tabular-nums leading-none ${marginColor}`}>
              {formatNumber(sales.grossMarginPct, 1)}%
            </p>
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className={`h-3.5 w-3.5 ${positive ? "text-purple-400" : "text-rose-400"}`} />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          Price vs landed
        </span>
      </div>
      <CompactLine
        label="Target selling"
        value={`${formatNumber(sales.targetSellingPriceEtbPerKg, 2)} ETB/kg`}
      />
      <CompactLine
        label="Landed cost"
        value={`${formatNumber(bottomLine.finalUnitCostEtbPerKg, 2)} ETB/kg`}
      />
      <CompactLine
        label="Expected revenue"
        value={formatEtb(sales.totalExpectedRevenueEtb, 0)}
      />
    </BentoCard>
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
    accent === "purple" ? "focus:ring-purple-500" : "focus:ring-cyan-500";
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

function CommandConsole({
  inputs,
  onChange,
}: {
  inputs: ImportFinanceInputs;
  onChange: (patch: Partial<ImportFinanceInputs>) => void;
}) {
  return (
    <aside className="lg:sticky lg:top-4 self-start">
      <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80 mb-4">
          Command console
        </p>

        <div className="space-y-4">
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

        <p className="mt-4 text-[10px] text-slate-600 border-t border-white/5 pt-3">
          Inland haul {LOCAL_CLEARANCE_PER_KG_ETB} ETB/kg · Moyale → Addis
        </p>
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
    () => calculateImportFinance(inputs, constants),
    [inputs, constants],
  );

  const qty = Math.max(inputs.quantityKg, 0);

  const bentoGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <MoyaleBento result={result} qty={qty} />
      <CustomsBento result={result} constants={constants} />
      <LandedBento result={result} qty={qty} />
      <MarketBento result={result} />
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
