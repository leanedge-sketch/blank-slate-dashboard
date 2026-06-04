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

/** Amount change reason is optional while the deal is at Discovery. */
export function amountChangeReasonRequired(currentStage: string): boolean {
  return currentStage !== "Discovery";
}

export const PIPELINE_STAGE_ORDER = [
  "Lead ID",
  "Discovery",
  "Sample",
  "Validation",
  "Proposal",
  "Confirmation",
  "Closed",
  "Lost",
] as const;
