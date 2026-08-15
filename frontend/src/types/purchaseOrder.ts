/** Loop C logistics purchase orders (shared `public.purchase_orders` table). */

export const LOGISTICS_STAGES = [
  "Origin Port",
  "Ocean Transit",
  "Djibouti Customs",
  "Modjo Dry Port",
  "Addis Delivery",
] as const;

export type LogisticsStage = (typeof LOGISTICS_STAGES)[number];

export interface PurchaseOrderRow {
  id: string;
  po_number: string | null;
  rfq_id: string | null;
  buyer_email: string;
  current_stage: string;
  last_updated: string;
  created_at?: string;
}

export function formatPoId(row: PurchaseOrderRow): string {
  return row.po_number || row.id.slice(0, 8).toUpperCase();
}

export function isLogisticsStage(value: string): value is LogisticsStage {
  return (LOGISTICS_STAGES as readonly string[]).includes(value);
}
