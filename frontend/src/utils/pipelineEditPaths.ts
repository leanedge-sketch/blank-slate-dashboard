import { TRADE_TRANSIT_ROUTES } from "../contexts/TradeTransitRequestContext";
import type { ImportShipmentRow } from "../services/importFinance";
import { newPipelinePath } from "./newPipelineSession";

export type PipelineRequestQuery = {
  requestRef: string;
  clientName?: string;
  customerId?: string;
};

export type PipelineReturnLink = {
  returnTo?: string;
  returnLabel?: string;
};

export function buildNewPipelinePath(): string {
  return newPipelinePath(false);
}

export function buildEditProductCostingPath(
  query: PipelineRequestQuery,
  options?: PipelineReturnLink,
): string {
  const params = new URLSearchParams();
  params.set("edit", "1");
  params.set("requestRef", query.requestRef.trim());
  const client = query.clientName?.trim();
  const customerId = query.customerId?.trim();
  if (client) params.set("client", client);
  if (customerId) params.set("customerId", customerId);
  if (options?.returnTo?.trim()) params.set("returnTo", options.returnTo.trim());
  if (options?.returnLabel?.trim()) params.set("returnLabel", options.returnLabel.trim());
  return `${TRADE_TRANSIT_ROUTES.productCosting}?${params.toString()}`;
}

/** Open product costing with a specific pipeline line selected. */
export function buildProductCostingLinePath(
  lineId: string,
  options?: PipelineReturnLink,
): string {
  const params = new URLSearchParams();
  params.set("line", lineId.trim());
  if (options?.returnTo?.trim()) params.set("returnTo", options.returnTo.trim());
  if (options?.returnLabel?.trim()) params.set("returnLabel", options.returnLabel.trim());
  return `${TRADE_TRANSIT_ROUTES.productCosting}?${params.toString()}`;
}

export function parseEditProductCostingSearchParams(
  searchParams: URLSearchParams,
): PipelineRequestQuery | null {
  if (searchParams.get("edit") !== "1") return null;
  const requestRef = searchParams.get("requestRef")?.trim() ?? "";
  if (!requestRef) return null;
  return {
    requestRef,
    clientName: searchParams.get("client")?.trim() || undefined,
    customerId: searchParams.get("customerId")?.trim() || undefined,
  };
}

export function filterShipmentsForPipelineRequest(
  shipments: ImportShipmentRow[],
  query: PipelineRequestQuery,
): ImportShipmentRow[] {
  const ref = query.requestRef.trim();
  const client = (query.clientName ?? "").trim();
  const customer = (query.customerId ?? "").trim();

  return shipments.filter((row) => {
    const rowRef = (row.request_ref ?? "").trim();
    const rowClient = (row.client_name ?? "").trim();
    const rowCustomer = (row.customer_id ?? "").trim();
    if (ref && rowRef !== ref) return false;
    if (client && rowClient !== client) return false;
    if (customer && rowCustomer !== customer) return false;
    return true;
  });
}

export function pipelineRequestQueryFromShipment(
  row: ImportShipmentRow,
): PipelineRequestQuery {
  return {
    requestRef: (row.request_ref ?? "").trim(),
    clientName: (row.client_name ?? "").trim() || undefined,
    customerId: (row.customer_id ?? "").trim() || undefined,
  };
}

export function parseReturnLinkSearchParams(
  searchParams: URLSearchParams,
): PipelineReturnLink | null {
  const returnTo = searchParams.get("returnTo")?.trim() ?? "";
  const returnLabel = searchParams.get("returnLabel")?.trim() ?? "";
  if (!returnTo) return null;
  return {
    returnTo,
    returnLabel: returnLabel || undefined,
  };
}
