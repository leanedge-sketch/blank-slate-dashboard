import { TRADE_TRANSIT_ROUTES } from "../contexts/TradeTransitRequestContext";
import type { ImportShipmentRow } from "../services/importFinance";
import { newPipelinePath } from "./newPipelineSession";

export type PipelineRequestQuery = {
  requestRef: string;
  clientName?: string;
  customerId?: string;
};

export function buildNewPipelinePath(): string {
  return newPipelinePath(true);
}

export function buildEditProductCostingPath(query: PipelineRequestQuery): string {
  const params = new URLSearchParams();
  params.set("edit", "1");
  params.set("requestRef", query.requestRef.trim());
  const client = query.clientName?.trim();
  const customerId = query.customerId?.trim();
  if (client) params.set("client", client);
  if (customerId) params.set("customerId", customerId);
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
