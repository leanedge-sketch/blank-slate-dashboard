import { useMemo, type ReactNode } from "react";
import {
  calculateImportFinance,
  formatEtb,
  formatNumber,
  formatUsd,
  LOCAL_CLEARANCE_PER_KG_ETB,
  type FinanceConstants,
  type ImportFinanceInputs,
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
};

type ImportFinanceCalculatorPanelProps = {
  inputs: ImportFinanceInputs;
  onChange: (patch: Partial<ImportFinanceInputs>) => void;
  constants?: FinanceConstants;
  compact?: boolean;
};

function SummaryRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${
        emphasize ? "font-semibold text-slate-900" : "text-slate-700"
      }`}
    >
      <span className="text-sm">{label}</span>
      <span className="text-sm tabular-nums text-right">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2">
      {children}
    </h3>
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

  function numField(
    key: keyof ImportFinanceInputs,
    label: string,
    step = "any",
  ) {
    return (
      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <input
          type="number"
          step={step}
          value={inputs[key]}
          onChange={(e) =>
            onChange({ [key]: Number.parseFloat(e.target.value) || 0 })
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </label>
    );
  }

  return (
    <div
      className={`grid gap-6 ${
        compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
      }`}
    >
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <h3 className="text-sm font-bold text-slate-900">Inputs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {numField("quantityKg", "Quantity (KG)", "1")}
          {numField("officialRate", "Official exchange rate ETB/USD")}
          {numField("parallelRate", "Parallel exchange rate ETB/USD")}
          {numField("supplierBasePriceUsd", "Supplier base price USD/kg", "0.0001")}
          {numField("supplierMarginPct", "Supplier margin %")}
          {numField("transportToBorderUsdPerKg", "Transport to border USD/kg", "0.0001")}
          {numField("baseCustomsReferenceUsd", "Base customs reference USD/kg", "0.0001")}
        </div>
        <p className="text-xs text-slate-500">
          Local clearance is fixed at {LOCAL_CLEARANCE_PER_KG_ETB} ETB/kg in the
          calculation engine.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-4">
        <h3 className="text-sm font-bold text-slate-900">Pipeline output</h3>

        <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
          <SectionTitle>1. Capital track (actual spend)</SectionTitle>
          <SummaryRow
            label="Material cost USD/kg"
            value={formatUsd(result.capital.materialCostUsdPerKg)}
          />
          <SummaryRow
            label="Border value USD/kg"
            value={formatUsd(result.capital.borderValueUsdPerKg)}
          />
          <SummaryRow
            label="Total capital USD"
            value={formatUsd(result.capital.totalCapitalUsd, 2)}
            emphasize
          />
          <SummaryRow
            label="Total capital ETB"
            value={formatEtb(result.capital.totalCapitalEtb, 0)}
            emphasize
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
          <SectionTitle>2. Customs track (assessed value)</SectionTitle>
          <SummaryRow
            label="CIF assessed USD/kg (ref + 10% buffer)"
            value={formatUsd(result.customs.cifAssessedUsdPerKg)}
          />
          <SummaryRow
            label="Total CIF assessed USD"
            value={formatUsd(result.customs.totalCifAssessedUsd, 2)}
          />
          <SummaryRow
            label="CIF base ETB"
            value={formatEtb(result.customs.cifBaseEtb, 0)}
            emphasize
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
          <SectionTitle>3. Tax waterfall</SectionTitle>
          <SummaryRow label="Duty (5%)" value={formatEtb(result.customs.dutyEtb, 0)} />
          <SummaryRow
            label="Scan fee (0.07%)"
            value={formatEtb(result.customs.scanFeeEtb, 0)}
          />
          <SummaryRow
            label="Social fee (3%)"
            value={formatEtb(result.customs.socialFeeEtb, 0)}
          />
          <SummaryRow label="WHT (3%)" value={formatEtb(result.customs.whtEtb, 0)} />
          <SummaryRow label="VAT (15%)" value={formatEtb(result.customs.vatEtb, 0)} />
          <SummaryRow
            label="Total customs paid"
            value={formatEtb(result.customs.totalCustomsPaidEtb, 0)}
            emphasize
          />
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <SectionTitle>4. Bottom line</SectionTitle>
          <SummaryRow
            label="Total local clearance"
            value={formatEtb(result.bottomLine.totalLocalClearanceEtb, 0)}
          />
          <SummaryRow
            label="Gross investment"
            value={formatEtb(result.bottomLine.grossInvestmentEtb, 0)}
          />
          <SummaryRow
            label="Net landed cost (excl. refundable WHT + VAT)"
            value={formatEtb(result.bottomLine.netLandedCostEtb, 0)}
            emphasize
          />
          <div className="mt-3 rounded-lg bg-indigo-600 px-4 py-3 text-center text-white">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-100">
              Final unit cost
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {formatNumber(result.bottomLine.finalUnitCostEtbPerKg, 2)} ETB/kg
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
