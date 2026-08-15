/** Loop A inbound RFQ types (shared `public.rfqs` table). */

export type RfqStatus =
  | "new"
  | "pending"
  | "under_review"
  | "sourcing"
  | "quoted"
  | "closed";

export interface RfqCartItem {
  productId?: string;
  slug?: string;
  name: string;
  casNumber: string;
  quantity?: string;
  packaging?: string;
  notes?: string;
}

export interface RfqRow {
  id: string;
  reference: string | null;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string | null;
  volume: number | string;
  unit: string;
  packaging: string;
  incoterms: string;
  target_delivery_date: string | null;
  items: RfqCartItem[] | null;
  status: string;
  created_at: string;
}

export const RFQ_STATUS_LABELS: Record<string, string> = {
  new: "Pending",
  pending: "Pending",
  under_review: "Under Review",
  sourcing: "Sourcing",
  quoted: "Quoted",
  closed: "Closed",
};

export function normalizeRfqStatus(status: string): string {
  if (status === "new") return "pending";
  return status || "pending";
}

export function formatRfqStatusLabel(status: string): string {
  const key = normalizeRfqStatus(status);
  return RFQ_STATUS_LABELS[key] ?? status;
}
