import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Info,
  MapPin,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import {
  formatEtb,
  formatEtbWorkbook,
  formatNumber,
  formatUsd,
  type FinanceConstants,
  DEFAULT_FINANCE_CONSTANTS,
} from "../../utils/importFinanceCalc";
import {
  createMiscBorderCostLine,
  DEFAULT_TRADE_TRANSIT_INPUTS,
  type MiscBorderCostLine,
  type TradeTransitInputs,
  type TradeTransitResult,
} from "../../utils/tradeTransitCalc";
import type { ExpectedCostScenario } from "../../utils/expectedCostCsv";
import { tradeTransitDisplayResult, tradeTransitInputsForCalculation } from "../../utils/workbookImportAlign";

export { DEFAULT_TRADE_TRANSIT_INPUTS };
export const DEFAULT_IMPORT_FINANCE_INPUTS = DEFAULT_TRADE_TRANSIT_INPUTS;

type StageId = 1 | 2 | 3 | 4;

type ImportFinanceCalculatorPanelProps = {
  productName?: string;
  inputs: TradeTransitInputs;
  workbookExpected?: ExpectedCostScenario["expected"] | null;
  onChange: (patch: Partial<TradeTransitInputs>) => void;
  constants?: FinanceConstants;
  compact?: boolean;
  /** Show every stage input at once; hide the read-only pipeline ledger. */
  expandAllInputs?: boolean;
  /** When this changes, focus Stage 1 in the ledger + input console. */
  focusStageSignal?: number;
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
  cyan: "border-cyan-500/40 ring-1 ring-cyan-500/20",
  amber: "border-amber-500/40 ring-1 ring-amber-500/20",
  emerald: "border-emerald-500/40 ring-1 ring-emerald-500/20",
  purple: "border-purple-500/40 ring-1 ring-purple-500/20",
};

const stageAccent: Record<StageId, Accent> = {
  1: "cyan",
  2: "amber",
  3: "emerald",
  4: "purple",
};

function WorkbookExcelMatchBanner({
  productName,
  expected,
}: {
  productName?: string;
  expected: ExpectedCostScenario["expected"];
}) {
  const label = productName?.trim() || "This product";
  return (
    <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
        Excel workbook — values copied from your sheet
      </p>
      <p className="mt-1 text-sm text-slate-200">
        <strong className="text-white">{label}</strong>
        <span className="text-slate-400">
          {" "}
          — stage totals below match Excel exactly (paste or CSV import). Pick the
          product tab that matches the same column in your sheet.
        </span>
      </p>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        <div className="rounded-lg border border-white/10 bg-slate-950/50 px-2.5 py-2">
          <p className="text-slate-500">Stage 1 capital</p>
          <p className="tabular-nums font-semibold text-cyan-300">
            {formatEtbWorkbook(expected.capitalOutlayEtb)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/50 px-2.5 py-2">
          <p className="text-slate-500">Stage 2 customs</p>
          <p className="tabular-nums font-semibold text-amber-300">
            {formatEtbWorkbook(expected.totalCustomsFeeEtb)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/50 px-2.5 py-2">
          <p className="text-slate-500">Stage 3 unit / kg</p>
          <p className="tabular-nums font-semibold text-emerald-300">
            {formatNumber(expected.unitCostEtbPerKg, 2)} ETB
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/50 px-2.5 py-2">
          <p className="text-slate-500">Stage 4 sell / kg</p>
          <p className="tabular-nums font-semibold text-purple-300">
            {expected.sellingPriceEtbPerKg > 0
              ? `${formatNumber(expected.sellingPriceEtbPerKg, 2)} ETB`
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
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
  active,
  onSelect,
  children,
}: {
  stage: StageId;
  title: string;
  icon: ReactNode;
  accent: Accent;
  kpiLabel: string;
  kpiValue: string;
  kpiSub?: string;
  open: boolean;
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border backdrop-blur-md transition-all ${
        active
          ? `bg-slate-900/70 ${accentBorderOpen[accent]}`
          : open
            ? `bg-slate-900/60 ${accentBorderOpen[accent]}`
            : "bg-slate-900/40 border-white/10 hover:border-white/20"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
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
            {active && (
              <span className="ml-2 text-cyan-500/80">· editing</span>
            )}
          </p>
          <p className={`text-sm font-semibold truncate ${accentTitle[accent]}`}>
            {title}
          </p>
        </div>
        <div className="text-right shrink-0 max-w-[45%]">
          <p className="text-[9px] uppercase tracking-wider text-slate-500 truncate">
            {kpiLabel}
          </p>
          <p
            className={`text-base sm:text-lg font-bold tabular-nums leading-tight ${accentTitle[accent]}`}
          >
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
        <div className="px-4 pb-4 border-t border-white/5 mx-3.5 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function pctLabel(decimal: number, digits = 2): string {
  return `${(decimal * 100).toFixed(digits)}%`;
}

/** Official assessment sheet labels scan fee 0.07% while applying ×0.007. */
function scanFeeLegacyPctLabel(scanFeePct: number): string {
  return `${(scanFeePct * 10).toFixed(2)}%`;
}

function PipelineStack({
  result,
  inputs,
  qty,
  activeStage,
  onStageChange,
}: {
  result: TradeTransitResult;
  inputs: TradeTransitInputs;
  qty: number;
  activeStage: StageId;
  onStageChange: (stage: StageId) => void;
}) {
  const [openStage, setOpenStage] = useState<StageId | null>(1);
  const s1 = result.stage1;
  const s2 = result.stage2;
  const s3 = result.stage3;
  const s4 = result.stage4;
  const positive = s4.profitPerKgEtb >= 0;

  const preVatTaxes = [
    { label: `Duty (${pctLabel(inputs.customsDutyPct, 0)})`, value: s2.dutyEtb },
    { label: `Scan (${scanFeeLegacyPctLabel(inputs.scanFeePct)})`, value: s2.scanFeeEtb },
    { label: `Social (${pctLabel(inputs.socialFeePct, 0)})`, value: s2.socialFeeEtb },
    {
      label: `Special (${inputs.taxSpecialGoodsPct.toFixed(0)}%)`,
      value: s2.specialGoodsEtb,
    },
    { label: `WHT (${pctLabel(inputs.whtPct, 0)})`, value: s2.whtEtb },
  ];
  const postVatTaxes = [
    { label: `Surtax (${pctLabel(inputs.surtaxPct, 0)})`, value: s2.surtaxEtb },
    { label: `Excise (${pctLabel(inputs.excisePct, 0)})`, value: s2.exciseEtb },
  ];

  function selectStage(stage: StageId) {
    onStageChange(stage);
    setOpenStage((prev) => (prev === stage ? null : stage));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1 px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/70">
          Pipeline ledger
        </p>
        <p className="text-[10px] text-slate-600">Click stage → edit inputs</p>
      </div>

      <PipelineAccordion
        stage={1}
        title="Origin & Border Outlay"
        accent="cyan"
        icon={<MapPin className="h-4 w-4" />}
        kpiLabel="Capital outlay · parallel"
        kpiValue={formatEtbWorkbook(s1.capitalOutlayEtb)}
        kpiSub={`@ ${formatNumber(s1.capitalParallelRate, 0)} ETB/USD`}
        open={openStage === 1}
        active={activeStage === 1}
        onSelect={() => selectStage(1)}
      >
        <DetailRow label="Material USD/kg" value={formatUsd(s1.materialUsdPerKg)} />
        <DetailRow label="+ Transport USD/kg" value={formatUsd(s1.transportUsdPerKg)} />
        {s1.miscBorderLines.map((line) => (
          <DetailRow
            key={line.id}
            label={`+ Misc${line.reason ? `: ${line.reason}` : ""}`}
            value={formatUsd(line.amountUsd, 2)}
          />
        ))}
        {s1.miscBorderUsdTotal > 0 && (
          <DetailRow
            label="Misc border total"
            value={formatUsd(s1.miscBorderUsdTotal, 2)}
          />
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
          rightValue={formatEtbWorkbook(s1.capitalOutlayEtb)}
          accent="cyan"
        />
      </PipelineAccordion>

      <PipelineAccordion
        stage={2}
        title="Customs Tax Waterfall"
        accent="amber"
        icon={<ShieldCheck className="h-4 w-4" />}
        kpiLabel="Total customs fee"
        kpiValue={formatEtbWorkbook(s2.totalCustomsPaidEtb)}
        kpiSub={`Duty math @ ${formatNumber(s2.customsOfficialRate, 0)} ETB/USD official`}
        open={openStage === 2}
        active={activeStage === 2}
        onSelect={() => selectStage(2)}
      >
        <DetailRow
          label={`FOB USD/kg (customs reference)`}
          value={formatUsd(inputs.baseCustomsReferenceUsd)}
        />
        <DetailRow
          label={`FOB × ${formatNumber(qty, 0)} kg × official rate`}
          value={formatEtb(s2.fobValueEtb, 0)}
        />
        <DetailRow
          label={`+ Freight & insurance (${pctLabel(inputs.cifBufferPct, 0)})`}
          value={formatEtb(s2.cifBaseEtb - s2.fobValueEtb, 0)}
        />
        <DetailRow
          label="Customs Duty Assessment Base (CIF)"
          value={formatEtb(s2.cifBaseEtb, 0)}
        />
        <DetailRow label="CIF USD/kg" value={formatUsd(s2.cifUsdPerKg)} />
        <DetailRow label="Total CIF USD" value={formatUsd(s2.totalCifUsd, 2)} />
        <ul className="mt-2 space-y-0.5">
          {preVatTaxes.map((t) => (
            <li key={t.label} className="flex justify-between text-sm text-slate-400">
              <span>{t.label}</span>
              <span className="tabular-nums font-mono text-xs">{formatEtb(t.value, 0)}</span>
            </li>
          ))}
        </ul>
        <DetailRow
          label="VAT base (CIF + duty + social)"
          value={formatEtb(s2.vatBaseEtb, 0)}
        />
        <div className="flex justify-between text-sm text-slate-400 py-0.5">
          <span>{`VAT (${pctLabel(inputs.vatPct, 0)})`}</span>
          <span className="tabular-nums font-mono text-xs">{formatEtb(s2.vatEtb, 0)}</span>
        </div>
        {postVatTaxes.some((t) => t.value > 0) && (
          <ul className="space-y-0.5">
            {postVatTaxes.map((t) => (
              <li key={t.label} className="flex justify-between text-sm text-slate-400">
                <span>{t.label}</span>
                <span className="tabular-nums font-mono text-xs">{formatEtb(t.value, 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </PipelineAccordion>

      <PipelineAccordion
        stage={3}
        title="Transit & Landed Cost"
        accent="emerald"
        icon={<Warehouse className="h-4 w-4" />}
        kpiLabel="Landed unit cost"
        kpiValue={`${formatNumber(s3.finalLandedUnitCostEtbPerKg, 2)} ETB/kg`}
        open={openStage === 3}
        active={activeStage === 3}
        onSelect={() => selectStage(3)}
      >
        <DetailRow
          label="Capital outlay (from Stage 1)"
          value={formatEtbWorkbook(s1.capitalOutlayEtb)}
        />
        <DetailRow label="+ Bank charges" value={formatEtb(s3.bankChargesEtb, 0)} />
        <DetailRow label="+ Insurance" value={formatEtb(s3.insuranceEtb, 0)} />
        <DetailRow
          label="+ Total customs (Stage 2)"
          value={formatEtbWorkbook(s2.totalCustomsPaidEtb)}
        />
        <DetailRow
          label="+ Betchem clearance"
          value={formatEtb(s3.betchemClearanceEtb, 0)}
        />
        <DetailRow
          label={`+ Transport Addis (${qty.toLocaleString()} × ${inputs.inlandClearancePerKgEtb})`}
          value={formatEtb(s3.transportAddisEtb, 0)}
        />
        <DetailRow
          label="− WHT + VAT (refundable)"
          value={formatEtb(s3.refundableWhtVatEtb, 0)}
        />
        <DetailRow
          label="Pre-landed base"
          value={formatEtb(s3.preProfitLandedBaseEtb, 0)}
        />
        <DetailRow label="+ Profit tax" value={formatEtb(s3.profitTaxEtb, 0)} />
        <DetailRow label="Total landed cost" value={formatEtbWorkbook(s3.netLandedCostEtb)} />
      </PipelineAccordion>

      <PipelineAccordion
        stage={4}
        title="Market Strategy"
        accent="purple"
        icon={<TrendingUp className="h-4 w-4" />}
        kpiLabel="Revenue / kg"
        kpiValue={`${formatNumber(s4.targetSellingPriceEtbPerKg, 2)} ETB/kg`}
        kpiSub={`${formatEtb(s4.totalExpectedRevenueEtb, 0)} total${qty > 0 ? ` · ${qty.toLocaleString()} kg` : ""}`}
        open={openStage === 4}
        active={activeStage === 4}
        onSelect={() => selectStage(4)}
      >
        <DetailRow
          label="Unit cost (landed)"
          value={`${formatNumber(s4.unitCostEtbPerKg, 4)} ETB/kg`}
        />
        <DetailRow
          label="Selling price"
          value={`${formatNumber(s4.targetSellingPriceEtbPerKg, 4)} ETB/kg`}
        />
        <DetailRow
          label="Profit / kg"
          value={`${positive ? "+" : ""}${formatNumber(s4.profitPerKgEtb, 4)} ETB`}
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
  readOnly,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange?: (v: number) => void;
  step?: string;
  accent?: Accent;
  suffix?: string;
  readOnly?: boolean;
}) {
  const ring =
    accent === "purple"
      ? "focus:ring-purple-500"
      : accent === "amber"
        ? "focus:ring-amber-500"
        : accent === "emerald"
          ? "focus:ring-emerald-500"
          : "focus:ring-cyan-500";

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="relative">
        <input
          type="number"
          step={step}
          readOnly={readOnly}
          value={value}
          onChange={(e) => onChange?.(Number.parseFloat(e.target.value) || 0)}
          className={`w-full rounded-lg bg-slate-950 border border-white/5 px-3 py-2 text-sm text-white transition focus:outline-none focus:ring-2 ${ring} ${suffix ? "pr-12" : ""} ${readOnly ? "opacity-70 cursor-default" : ""}`}
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

function PercentField({
  label,
  hint,
  decimalValue,
  onChange,
  step = "0.01",
  accent,
  defaultDecimal,
}: {
  label: string;
  hint?: string;
  decimalValue: number;
  onChange: (decimal: number) => void;
  step?: string;
  accent?: Accent;
  defaultDecimal?: number;
}) {
  const defaultHint =
    defaultDecimal != null
      ? `Default ${pctLabel(defaultDecimal, defaultDecimal < 0.01 ? 2 : 0)}`
      : undefined;
  return (
    <NumberField
      label={label}
      hint={hint ?? defaultHint}
      value={decimalValue * 100}
      onChange={(v) => onChange(v / 100)}
      step={step}
      suffix="%"
      accent={accent}
    />
  );
}

function StageInputPanel({
  stage,
  inputs,
  result,
  onChange,
}: {
  stage: StageId;
  inputs: TradeTransitInputs;
  result: TradeTransitResult;
  onChange: (patch: Partial<TradeTransitInputs>) => void;
}) {
  const accent = stageAccent[stage];
  const specialGoods15 = inputs.taxSpecialGoodsPct === 15;

  function updateMiscLine(id: string, patch: Partial<MiscBorderCostLine>) {
    onChange({
      miscBorderCosts: inputs.miscBorderCosts.map((line) =>
        line.id === id ? { ...line, ...patch } : line,
      ),
    });
  }

  function removeMiscLine(id: string) {
    onChange({
      miscBorderCosts: inputs.miscBorderCosts.filter((line) => line.id !== id),
    });
  }

  const titles: Record<StageId, string> = {
    1: "Stage 1 inputs · Origin & border (USD)",
    2: "Stage 2 inputs · Customs (official rate)",
    3: "Stage 3 inputs · Inland transit (ETB)",
    4: "Stage 4 inputs · Pricing & margin",
  };

  return (
    <div
      className={`rounded-lg border bg-black/20 p-4 ${accentBorderOpen[accent]}`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${accentTitle[accent]}`}>
        {titles[stage]}
      </p>

      {stage === 1 && (
        <div className="space-y-3">
          <NumberField
            label="Quantity"
            value={inputs.quantityKg}
            onChange={(v) => onChange({ quantityKg: v })}
            step="1"
            suffix="kg"
            accent="cyan"
          />
          <NumberField
            label="Supplier base price"
            value={inputs.supplierBasePriceUsd}
            onChange={(v) => onChange({ supplierBasePriceUsd: v })}
            step="0.0001"
            suffix="USD/kg"
            accent="cyan"
          />
          <NumberField
            label="Supplier margin"
            value={inputs.supplierMarginPct}
            onChange={(v) => onChange({ supplierMarginPct: v })}
            suffix="%"
            accent="cyan"
          />
          <NumberField
            label="Transport to Moyale"
            value={inputs.transportToMoyaleUsdPerKg}
            onChange={(v) => onChange({ transportToMoyaleUsdPerKg: v })}
            step="0.0001"
            suffix="USD/kg"
            accent="cyan"
          />
          <div className="space-y-2 pt-1 border-t border-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Misc border costs (USD)
            </p>
            {inputs.miscBorderCosts.map((line, index) => (
              <div
                key={line.id}
                className="rounded-lg border border-white/5 bg-slate-950/50 p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Line {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeMiscLine(line.id)}
                    className="text-slate-500 hover:text-rose-400 p-0.5"
                    aria-label="Remove misc cost"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <NumberField
                  label="Amount"
                  value={line.amountUsd}
                  onChange={(v) => updateMiscLine(line.id, { amountUsd: v })}
                  step="0.01"
                  suffix="USD"
                />
                <TextField
                  label="Reason"
                  value={line.reason}
                  onChange={(v) => updateMiscLine(line.id, { reason: v })}
                  placeholder="e.g. Moyale storage fee"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onChange({
                  miscBorderCosts: [
                    ...inputs.miscBorderCosts,
                    createMiscBorderCostLine(),
                  ],
                })
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-cyan-500/30 py-2 text-xs font-medium text-cyan-400 hover:bg-cyan-500/10 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add misc border cost
            </button>
          </div>
          <NumberField
            label="Capital / parallel rate"
            hint="USD border total → capital outlay (ETB)"
            value={inputs.capitalParallelRate}
            onChange={(v) => onChange({ capitalParallelRate: v })}
            accent="cyan"
            suffix="ETB/USD"
          />
        </div>
      )}

      {stage === 2 && (
        <div className="space-y-3">
          <NumberField
            label="Customs official rate"
            hint="FOB USD → FOB ETB, then CIF assessment base and customs taxes"
            value={inputs.customsOfficialRate}
            onChange={(v) => onChange({ customsOfficialRate: v })}
            accent="amber"
            suffix="ETB/USD"
          />
          <p className="flex items-start gap-1.5 text-[10px] text-amber-500/80 leading-snug">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Official rate only — never applied to capital outlay.
          </p>
          <NumberField
            label="Base customs reference"
            value={inputs.baseCustomsReferenceUsd}
            onChange={(v) => onChange({ baseCustomsReferenceUsd: v })}
            step="0.0001"
            suffix="USD/kg"
            accent="amber"
          />

          <div className="pt-2 border-t border-white/5 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">
              Customs fee rates
            </p>
            <p className="text-[10px] text-slate-500 leading-snug">
              Duty, scan, social, and WHT apply to the CIF assessment base. VAT
              applies to CIF + duty + social. Scan fee uses legacy sheet label
              0.07% with multiplier 0.007.
            </p>
            <PercentField
              label="CIF freight & insurance buffer"
              hint="FOB ETB × (1 + buffer) = Customs Duty Assessment Base (default 10%)"
              decimalValue={inputs.cifBufferPct}
              onChange={(v) => onChange({ cifBufferPct: v })}
              step="0.1"
              accent="amber"
              defaultDecimal={DEFAULT_FINANCE_CONSTANTS.freightInsuranceBufferPct}
            />
            <PercentField
              label="Customs duty"
              decimalValue={inputs.customsDutyPct}
              onChange={(v) => onChange({ customsDutyPct: v })}
              accent="amber"
              defaultDecimal={DEFAULT_FINANCE_CONSTANTS.customsDutyPct}
            />
            <NumberField
              label="Scan fee"
              hint="Label 0.07% on official sheet; ×0.007 on CIF base"
              value={inputs.scanFeePct * 10}
              onChange={(v) => onChange({ scanFeePct: v / 10 })}
              step="0.01"
              suffix="%"
              accent="amber"
            />
            <PercentField
              label="Social contribution"
              decimalValue={inputs.socialFeePct}
              onChange={(v) => onChange({ socialFeePct: v })}
              accent="amber"
              defaultDecimal={DEFAULT_FINANCE_CONSTANTS.socialFeePct}
            />
            <div className="flex items-center gap-2">
              <input
                id="special-goods-15"
                type="checkbox"
                checked={specialGoods15}
                onChange={(e) =>
                  onChange({ taxSpecialGoodsPct: e.target.checked ? 15 : 0 })
                }
                className="rounded border-white/20 bg-slate-900 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="special-goods-15" className="text-xs text-slate-400">
                Apply 15% special goods tax (default off)
              </label>
            </div>
            <NumberField
              label="Special goods tax"
              value={inputs.taxSpecialGoodsPct}
              onChange={(v) => onChange({ taxSpecialGoodsPct: v })}
              suffix="%"
              accent="amber"
            />
            <PercentField
              label="Withholding tax (WHT)"
              decimalValue={inputs.whtPct}
              onChange={(v) => onChange({ whtPct: v })}
              accent="amber"
              defaultDecimal={DEFAULT_FINANCE_CONSTANTS.whtPct}
            />
            <PercentField
              label="VAT"
              decimalValue={inputs.vatPct}
              onChange={(v) => onChange({ vatPct: v })}
              accent="amber"
              defaultDecimal={DEFAULT_FINANCE_CONSTANTS.vatPct}
            />
            <PercentField
              label="Surtax"
              decimalValue={inputs.surtaxPct}
              onChange={(v) => onChange({ surtaxPct: v })}
              accent="amber"
              defaultDecimal={0}
            />
            <PercentField
              label="Excise"
              decimalValue={inputs.excisePct}
              onChange={(v) => onChange({ excisePct: v })}
              accent="amber"
              defaultDecimal={0}
            />
          </div>

          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs text-slate-400">
            Total customs (preview):{" "}
            <span className="font-bold text-amber-200 tabular-nums">
              {formatEtbWorkbook(result.stage2.totalCustomsPaidEtb)}
            </span>
          </div>
        </div>
      )}

      {stage === 3 && (
        <div className="space-y-3">
          <PercentField
            label="Bank charges"
            hint="Share of capital outlay (legacy Excel default 7.8%)"
            decimalValue={inputs.bankChargePctOnCapital}
            onChange={(v) => onChange({ bankChargePctOnCapital: v })}
            step="0.1"
            accent="emerald"
            defaultDecimal={DEFAULT_TRADE_TRANSIT_INPUTS.bankChargePctOnCapital}
          />
          <NumberField
            label="Insurance"
            value={inputs.insuranceEtb}
            onChange={(v) => onChange({ insuranceEtb: v })}
            suffix="ETB"
            accent="emerald"
          />
          <NumberField
            label="Betchem clearance"
            value={inputs.betchemClearanceEtb}
            onChange={(v) => onChange({ betchemClearanceEtb: v })}
            suffix="ETB"
            accent="emerald"
          />
          <PercentField
            label="Profit tax"
            hint="Share of pre-landed base (before profit tax)"
            decimalValue={inputs.profitTaxPctOnPreLanded}
            onChange={(v) => onChange({ profitTaxPctOnPreLanded: v })}
            step="0.01"
            accent="emerald"
          />
          <NumberField
            label="Transport Addis per kg"
            hint={`Default ${DEFAULT_TRADE_TRANSIT_INPUTS.inlandClearancePerKgEtb} ETB/kg unless changed`}
            value={inputs.inlandClearancePerKgEtb}
            onChange={(v) => onChange({ inlandClearancePerKgEtb: v })}
            suffix="ETB/kg"
            accent="emerald"
          />
          <NumberField
            label="Quantity"
            value={inputs.quantityKg}
            onChange={(v) => onChange({ quantityKg: v })}
            step="1"
            suffix="kg"
            accent="emerald"
          />
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 text-xs text-slate-400 space-y-1">
            <p>
              Bank charges:{" "}
              <span className="font-bold text-emerald-300 tabular-nums">
                {formatEtb(result.stage3.bankChargesEtb, 0)}
              </span>
            </p>
            <p>
              Profit tax:{" "}
              <span className="font-bold text-emerald-300 tabular-nums">
                {formatEtb(result.stage3.profitTaxEtb, 0)}
              </span>
            </p>
            <p>
              Total landed:{" "}
              <span className="font-bold text-emerald-300 tabular-nums">
                {formatEtbWorkbook(result.stage3.netLandedCostEtb)}
              </span>
            </p>
            <p>
              Unit cost:{" "}
              <span className="font-bold text-emerald-300 tabular-nums">
                {formatNumber(result.stage3.finalLandedUnitCostEtbPerKg, 2)} ETB/kg
              </span>
            </p>
          </div>
        </div>
      )}

      {stage === 4 && (
        <div className="space-y-3">
          <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 px-3 py-2 text-xs text-slate-400">
            Unit cost:{" "}
            <span className="font-mono text-purple-200">
              {formatNumber(result.stage4.unitCostEtbPerKg, 4)} ETB/kg
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ sellingPriceMode: "margin" })}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                inputs.sellingPriceMode === "margin"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-900 text-slate-400 border border-white/10"
              }`}
            >
              Target margin %
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  sellingPriceMode: "manual",
                  targetSellingPriceEtbPerKg:
                    result.stage4.targetSellingPriceEtbPerKg,
                })
              }
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                inputs.sellingPriceMode === "manual"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-900 text-slate-400 border border-white/10"
              }`}
            >
              Manual price
            </button>
          </div>
          {inputs.sellingPriceMode === "margin" ? (
            <>
              <NumberField
                label="Target gross margin"
                hint="Price = unitCost ÷ (1 − margin%). True gross margin, not markup."
                value={inputs.targetMarginPct}
                onChange={(v) => onChange({ targetMarginPct: v, sellingPriceMode: "margin" })}
                step="0.1"
                suffix="%"
                accent="purple"
              />
              <NumberField
                label="Computed selling price"
                value={result.stage4.targetSellingPriceEtbPerKg}
                readOnly
                suffix="ETB/kg"
                accent="purple"
              />
            </>
          ) : (
            <NumberField
              label="Target selling price"
              value={inputs.targetSellingPriceEtbPerKg}
              onChange={(v) =>
                onChange({ targetSellingPriceEtbPerKg: v, sellingPriceMode: "manual" })
              }
              step="0.01"
              suffix="ETB/kg"
              accent="purple"
            />
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-950/80 p-2 border border-white/5">
              <p className="text-slate-500 text-[10px] uppercase">Profit/kg</p>
              <p
                className={`font-bold tabular-nums ${result.stage4.profitPerKgEtb >= 0 ? "text-emerald-400" : "text-rose-400"}`}
              >
                {formatNumber(result.stage4.profitPerKgEtb, 4)} ETB
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/80 p-2 border border-white/5">
              <p className="text-slate-500 text-[10px] uppercase">Margin %</p>
              <p
                className={`font-bold tabular-nums ${result.stage4.profitPerKgEtb >= 0 ? "text-purple-300" : "text-rose-400"}`}
              >
                {formatNumber(result.stage4.grossMarginPct, 2)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InputConsole({
  activeStage,
  inputs,
  result,
  onChange,
  expandAllInputs = false,
}: {
  activeStage: StageId;
  inputs: TradeTransitInputs;
  result: TradeTransitResult;
  onChange: (patch: Partial<TradeTransitInputs>) => void;
  expandAllInputs?: boolean;
}) {
  if (expandAllInputs) {
    const stages: StageId[] = [1, 2, 3, 4];
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-4 lg:sticky lg:top-4">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80">
            All stage inputs
          </p>
        </div>
        <p className="text-[10px] text-slate-600 mb-4">
          Edit any field below. Computed totals update as you type.
        </p>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
          {stages.map((stage) => (
            <StageInputPanel
              key={stage}
              stage={stage}
              inputs={inputs}
              result={result}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-4 lg:sticky lg:top-4">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80">
          Input console
        </p>
      </div>
      <p className="text-[10px] text-slate-600 mb-3">
        Showing parameters for{" "}
        <span className="text-slate-400">Stage {activeStage}</span>. Defaults
        apply until you change them.
      </p>
      <StageInputPanel
        stage={activeStage}
        inputs={inputs}
        result={result}
        onChange={onChange}
      />
    </div>
  );
}

export function ImportFinanceCalculatorPanel({
  productName = "",
  inputs,
  workbookExpected = null,
  onChange,
  constants = DEFAULT_FINANCE_CONSTANTS,
  compact = false,
  expandAllInputs = false,
  focusStageSignal = 0,
}: ImportFinanceCalculatorPanelProps) {
  const [activeStage, setActiveStage] = useState<StageId>(1);

  useEffect(() => {
    if (focusStageSignal > 0) {
      setActiveStage(1);
    }
  }, [focusStageSignal]);

  const calcInputs = useMemo(
    () => tradeTransitInputsForCalculation(inputs, workbookExpected),
    [inputs, workbookExpected],
  );

  const result = useMemo(
    () => tradeTransitDisplayResult(calcInputs, workbookExpected, constants),
    [calcInputs, workbookExpected, constants],
  );

  const qty = Math.max(inputs.quantityKg, 0);

  if (expandAllInputs) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs text-slate-400">
            Landed unit cost (computed)
          </p>
          <p className="text-lg font-bold tabular-nums text-emerald-300">
            {formatNumber(result.stage3.finalLandedUnitCostEtbPerKg, 2)} ETB/kg
          </p>
        </div>
        <InputConsole
          activeStage={activeStage}
          inputs={inputs}
          result={result}
          onChange={onChange}
          expandAllInputs
        />
      </div>
    );
  }

  return (
    <div
      className={`grid gap-5 ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]"}`}
    >
      {workbookExpected ? (
        <div className="order-1 lg:col-span-2">
          <WorkbookExcelMatchBanner
            productName={productName}
            expected={workbookExpected}
          />
        </div>
      ) : null}
      <div className="min-w-0 order-2">
        <PipelineStack
          result={result}
          inputs={inputs}
          qty={qty}
          activeStage={activeStage}
          onStageChange={setActiveStage}
        />
      </div>
      <div className="min-w-0 order-3 lg:order-3">
        <InputConsole
          activeStage={activeStage}
          inputs={inputs}
          result={result}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
