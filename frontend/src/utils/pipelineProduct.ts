import type { ChemicalFullData, ChemicalType, SalesPipeline, Tds } from "../services/api";

/** Display label for a deal's product (chemical catalog or TDS). */
export function getPipelineProductLabel(
  pipeline: SalesPipeline,
  options: {
    chemicalFullData?: ChemicalFullData[];
    chemicalTypes?: ChemicalType[];
    tdsList?: Tds[];
  } = {},
): string {
  const { chemicalFullData = [], chemicalTypes = [], tdsList = [] } = options;
  const chemicalTypeId = pipeline.chemical_type_id;

  if (chemicalTypeId) {
    const byUuid = chemicalFullData.find((c) => c.uuid_id === chemicalTypeId);
    if (byUuid?.product_name) return byUuid.product_name;

    const numericId = parseInt(String(chemicalTypeId), 10);
    if (!Number.isNaN(numericId) && numericId > 0) {
      const byId = chemicalFullData.find((c) => c.id === numericId);
      if (byId?.product_name) return byId.product_name;
    }

    const chemicalType = chemicalTypes.find(
      (ct) => String(ct.id) === String(chemicalTypeId),
    );
    if (chemicalType?.name) return chemicalType.name;
  }

  if (pipeline.tds_id) {
    const tds = tdsList.find((t) => t.id === pipeline.tds_id);
    if (tds) {
      const label = `${tds.brand || ""} ${tds.grade || ""}`.trim();
      return label || tds.id;
    }
    return pipeline.tds_id;
  }

  return "General / no product linked";
}

export const PIPELINE_STAGE_COLORS: Record<string, string> = {
  "Lead ID": "bg-slate-100 text-slate-700 border-slate-300",
  Discovery: "bg-blue-100 text-blue-700 border-blue-300",
  Sample: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Validation: "bg-orange-100 text-orange-700 border-orange-300",
  Proposal: "bg-indigo-100 text-indigo-700 border-indigo-300",
  Confirmation: "bg-green-100 text-green-700 border-green-300",
  Closed: "bg-emerald-500 text-white border-emerald-600",
  Lost: "bg-red-100 text-red-700 border-red-300",
};

/** Seven main pipeline stages (excludes Lost). */
export const SEVEN_PIPELINE_STAGES = [
  "Lead ID",
  "Discovery",
  "Sample",
  "Validation",
  "Proposal",
  "Confirmation",
  "Closed",
] as const;

export type SevenPipelineStage = (typeof SEVEN_PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_ORDER = [
  ...SEVEN_PIPELINE_STAGES,
  "Lost",
] as const;

export function pipelineStageIndex(stage: string): number {
  return SEVEN_PIPELINE_STAGES.indexOf(stage as SevenPipelineStage);
}

/** Next sequential stage, or null if already at Closed / unknown. */
export function getNextPipelineStage(stage: string): SevenPipelineStage | null {
  const idx = pipelineStageIndex(stage);
  if (idx < 0 || idx >= SEVEN_PIPELINE_STAGES.length - 1) return null;
  return SEVEN_PIPELINE_STAGES[idx + 1];
}

export type UpdateStageOption = {
  stage: SevenPipelineStage | "Lost";
  hint: string;
};

/** All seven stages except current, plus Lost. Next stage is marked recommended. */
export function getUpdateStageOptions(current: string): UpdateStageOption[] {
  const next = getNextPipelineStage(current);
  const options: UpdateStageOption[] = SEVEN_PIPELINE_STAGES.filter(
    (s) => s !== current,
  ).map((stage) => ({
    stage,
    hint:
      stage === next
        ? " (Recommended — next stage)"
        : stage === "Closed"
          ? " (Close deal)"
          : "",
  }));
  if (current !== "Lost") {
    options.push({ stage: "Lost", hint: " (Deal lost)" });
  }
  return options;
}

/** Effective stage after update (pre-selected next stage when unchanged). */
export function getEffectiveTargetStage(
  currentStage: string,
  formStage?: string | null,
): string {
  const picked = formStage?.trim() || currentStage;
  if (picked !== currentStage) return picked;
  return getNextPipelineStage(currentStage) ?? currentStage;
}

/** Display value for quantity inputs — preserves 0 (not treated as empty). */
export function formatPipelineAmountInput(
  formAmount: number | null | undefined,
  fallbackAmount?: number | null,
): string {
  if (formAmount !== undefined && formAmount !== null) {
    return String(formAmount);
  }
  if (fallbackAmount !== undefined && fallbackAmount !== null) {
    return String(fallbackAmount);
  }
  return "";
}

/**
 * Amount change reason is optional at Discovery/Sample or when quantity is 0 (TBD).
 */
export function amountChangeReasonRequired(
  currentStage: string,
  newAmount?: number | null,
): boolean {
  if (currentStage === "Discovery" || currentStage === "Sample") return false;
  if (newAmount === 0) return false;
  return true;
}

export type PipelineStageUpdateEntry = {
  versionNumber: number;
  versionId: string;
  createdAt: string | null;
  fromStage?: string;
  stage: string;
  stageChanged: boolean;
  amountChanged: boolean;
  stageChangeReason?: string | null;
  amount?: number | null;
  previousAmount?: number | null;
  unit?: string | null;
  amountChangeReason?: string | null;
  isInitial?: boolean;
  closeReason?: string | null;
};

export function sortPipelineVersions(versions: SalesPipeline[]): SalesPipeline[] {
  return [...versions].sort((a, b) => {
    const va = a.version_number ?? 0;
    const vb = b.version_number ?? 0;
    if (va !== vb) return va - vb;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
}

/** Group version history into per-stage update lists (Lead ID through Lost). */
export function buildPipelineStageUpdateMap(
  versions: SalesPipeline[],
): Record<string, PipelineStageUpdateEntry[]> {
  const result: Record<string, PipelineStageUpdateEntry[]> = {};
  const add = (stage: string, entry: PipelineStageUpdateEntry) => {
    if (!result[stage]) result[stage] = [];
    result[stage].push(entry);
  };

  const sorted = sortPipelineVersions(versions);
  for (let i = 0; i < sorted.length; i++) {
    const version = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const stage = version.stage;
    const stageChanged = !prev || prev.stage !== version.stage;
    const amountChanged = !!prev && prev.amount !== version.amount;

    if (i === 0) {
      add(stage, {
        versionNumber: version.version_number ?? 1,
        versionId: version.id,
        createdAt: version.created_at ?? null,
        stage,
        stageChanged: false,
        amountChanged: false,
        amount: version.amount ?? null,
        unit: version.unit ?? null,
        isInitial: true,
      });
      continue;
    }

    if (stageChanged || amountChanged) {
      add(stage, {
        versionNumber: version.version_number ?? i + 1,
        versionId: version.id,
        createdAt: version.created_at ?? null,
        fromStage: prev?.stage,
        stage,
        stageChanged,
        amountChanged,
        stageChangeReason: version.reason_for_stage_change,
        amount: version.amount ?? null,
        previousAmount: prev?.amount ?? null,
        unit: version.unit ?? null,
        amountChangeReason: version.reason_for_amount_change,
        closeReason: version.close_reason ?? null,
      });
    }
  }

  return result;
}
