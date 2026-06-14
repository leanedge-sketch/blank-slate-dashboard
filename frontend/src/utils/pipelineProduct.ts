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

  const meta = (pipeline.metadata || {}) as Record<string, unknown>;
  const metaName = meta.product_name;
  if (typeof metaName === "string" && metaName.trim()) {
    return metaName.trim();
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

/** Proposal and later need the full commercial form (same as Edit Pipeline). */
export const STAGES_REQUIRING_FULL_COMMERCIAL = [
  "Proposal",
  "Confirmation",
  "Closed",
] as const;

/** Lead ID only — product and amount become required from Discovery onward. */
export const STAGES_WITH_OPTIONAL_COMMERCIAL = ["Lead ID"] as const;

export const STAGES_REQUIRING_PRODUCT_AND_AMOUNT = [
  "Discovery",
  "Sample",
  "Validation",
  "Proposal",
  "Confirmation",
  "Closed",
] as const;

/** Alias for Proposal+ business requirements (used by list/edit pages). */
export const STAGES_REQUIRING_BUSINESS_DETAILS = [
  ...STAGES_REQUIRING_FULL_COMMERCIAL,
] as const;

export type PipelineDealFormValues = {
  chemical_type_id: string;
  vendor_name: string;
  expected_close_date: string;
  lead_source: string;
  contact_per_lead: string;
  business_model: string;
  business_unit: string;
  unit: string;
  amount: number | "" | null;
  unit_price: number | "" | null;
  currency: string;
  forex: string;
  incoterm: string;
  pricing_record_id?: string;
};

export function pipelineToDealFormValues(
  pipeline: SalesPipeline,
): PipelineDealFormValues {
  const meta = (pipeline.metadata || {}) as Record<string, unknown>;
  const vendor =
    (meta.vendor as string) || (meta.vendor_name as string) || "";

  return {
    chemical_type_id: pipeline.chemical_type_id || "",
    vendor_name: vendor,
    expected_close_date: pipeline.expected_close_date
      ? String(pipeline.expected_close_date).slice(0, 10)
      : "",
    lead_source: pipeline.lead_source || "",
    contact_per_lead: pipeline.contact_per_lead || "",
    business_model: pipeline.business_model || "",
    business_unit: pipeline.business_unit || "",
    unit: pipeline.unit || "",
    amount: pipeline.amount ?? ("" as number | ""),
    unit_price: pipeline.unit_price ?? ("" as number | ""),
    currency: pipeline.currency || "",
    forex: pipeline.forex || "",
    incoterm: pipeline.incoterm || "",
    pricing_record_id:
      typeof meta.pricing_record_id === "string" ? meta.pricing_record_id : "",
  };
}

export function pipelineTargetRequiresFullCommercial(stage: string): boolean {
  return STAGES_REQUIRING_FULL_COMMERCIAL.includes(
    stage as (typeof STAGES_REQUIRING_FULL_COMMERCIAL)[number],
  );
}

export function pipelineStageRequiresProductAndAmount(stage: string): boolean {
  return STAGES_REQUIRING_PRODUCT_AND_AMOUNT.includes(
    stage as (typeof STAGES_REQUIRING_PRODUCT_AND_AMOUNT)[number],
  );
}

export function pipelineUpdateShowsProductAmountForm(targetStage: string): boolean {
  return pipelineStageRequiresProductAndAmount(targetStage);
}

/**
 * Show the full commercial form when entering Proposal, or when jumping to
 * Confirmation/Closed before commercial data exists on the deal.
 */
export function pipelineUpdateShowsCommercialForm(
  targetStage: string,
  dealForm: PipelineDealFormValues,
): boolean {
  if (!pipelineTargetRequiresFullCommercial(targetStage)) {
    return false;
  }
  if (targetStage === "Proposal") {
    return true;
  }
  return validateDealFormForProposal(dealForm) !== null;
}

/** Product, unit, and quantity required from Discovery onward. */
export function validateDealFormForProductAndAmount(
  form: PipelineDealFormValues,
  targetStage: string,
): string | null {
  if (!pipelineStageRequiresProductAndAmount(targetStage)) {
    return null;
  }
  if (!form.chemical_type_id.trim()) {
    return "Product is required from Discovery stage onward.";
  }
  if (!form.unit.trim()) {
    return "Unit is required from Discovery stage onward.";
  }
  if (form.amount === "" || form.amount === null || form.amount === undefined) {
    return "Amount (quantity) is required from Discovery stage onward.";
  }
  if (targetStage !== "Sample" && Number(form.amount) <= 0) {
    return "Enter a quantity greater than 0 from Discovery stage onward.";
  }
  return null;
}

/** Client-side validation for the full commercial form (Proposal entry only). */
export function validateDealFormForProposal(
  form: PipelineDealFormValues,
): string | null {
  if (!form.chemical_type_id.trim()) {
    return "Product is required when moving to Proposal.";
  }
  if (!form.vendor_name.trim()) {
    return "Vendor is required when moving to Proposal.";
  }
  if (!form.expected_close_date.trim()) {
    return "Expected close date is required when moving to Proposal.";
  }
  if (!form.business_model.trim()) {
    return "Business model is required when moving to Proposal.";
  }
  if (!form.business_unit.trim()) {
    return "Business unit is required when moving to Proposal.";
  }
  if (!form.unit.trim()) {
    return "Unit is required when moving to Proposal.";
  }
  if (form.amount === "" || form.amount === null || form.amount === undefined) {
    return "Amount (quantity) is required when moving to Proposal.";
  }
  if (
    form.unit_price === "" ||
    form.unit_price === null ||
    form.unit_price === undefined
  ) {
    return "Unit price is required when moving to Proposal.";
  }
  if (!form.currency.trim()) {
    return "Currency is required when moving to Proposal.";
  }
  if (!form.forex.trim()) {
    return "Forex is required when moving to Proposal.";
  }
  if (!form.incoterm.trim()) {
    return "Incoterm is required when moving to Proposal.";
  }
  return null;
}

export function validateDealFormForTargetStage(
  form: PipelineDealFormValues,
  targetStage: string,
): string | null {
  const productAmountError = validateDealFormForProductAndAmount(form, targetStage);
  if (productAmountError) {
    return productAmountError;
  }
  if (!pipelineUpdateShowsCommercialForm(targetStage, form)) {
    return null;
  }
  return validateDealFormForProposal(form);
}

export function buildPipelineProductAmountPayload(
  dealForm: PipelineDealFormValues,
): Record<string, unknown> {
  return {
    chemical_type_id: dealForm.chemical_type_id.trim() || null,
    unit: dealForm.unit.trim() || null,
    amount:
      dealForm.amount === "" || dealForm.amount === null
        ? null
        : Number(dealForm.amount),
  };
}

/** Build commercial fields payload for a pipeline stage update. */
export function buildPipelineCommercialUpdatePayload(
  dealForm: PipelineDealFormValues,
  existingMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const metadata: Record<string, unknown> = { ...existingMetadata };
  if (dealForm.vendor_name.trim()) {
    metadata.vendor = dealForm.vendor_name.trim();
  }
  if (dealForm.pricing_record_id?.trim()) {
    metadata.pricing_record_id = dealForm.pricing_record_id.trim();
    metadata.pricing_locked = true;
  }
  return {
    chemical_type_id: dealForm.chemical_type_id.trim() || null,
    expected_close_date: dealForm.expected_close_date.trim() || null,
    lead_source: dealForm.lead_source.trim() || null,
    contact_per_lead: dealForm.contact_per_lead.trim() || null,
    business_model: dealForm.business_model.trim() || null,
    business_unit: dealForm.business_unit.trim() || null,
    unit: dealForm.unit.trim() || null,
    amount:
      dealForm.amount === "" || dealForm.amount === null
        ? null
        : Number(dealForm.amount),
    unit_price:
      dealForm.unit_price === "" || dealForm.unit_price === null
        ? null
        : Number(dealForm.unit_price),
    currency: dealForm.currency.trim() || null,
    forex: dealForm.forex.trim() || null,
    incoterm: dealForm.incoterm.trim() || null,
    metadata,
  };
}

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

/** Human-readable quantity with unit (amount field = quantity, not currency). */
export function formatPipelineQuantity(
  amount: number | null | undefined,
  unit?: string | null,
): string {
  if (amount === null || amount === undefined) return "—";
  const label = unit?.trim() || "units";
  if (amount === 0) return `0 ${label} (TBD)`;
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${label}`;
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
 * Stage-change reason is required when moving backward, skipping stages, closing,
 * marking Lost, or reopening from Lost. Normal +1 forward progression does not
 * require a reason.
 */
export function stageChangeReasonRequired(
  oldStage: string,
  newStage: string,
): boolean {
  if (oldStage === newStage) return false;
  if (newStage === "Closed" || newStage === "Lost") return true;
  if (oldStage === "Lost") return true;

  const order = SEVEN_PIPELINE_STAGES as readonly string[];
  const oldIndex = order.indexOf(oldStage);
  const newIndex = order.indexOf(newStage);
  if (oldIndex < 0 || newIndex < 0) return false;
  if (newIndex === oldIndex + 1) return false;
  if (newIndex < oldIndex) return true;
  if (newIndex > oldIndex + 1) return true;
  return false;
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
