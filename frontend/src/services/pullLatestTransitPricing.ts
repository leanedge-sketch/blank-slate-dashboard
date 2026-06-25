import {
  loadPricingLocations,
  loadPricingRecords,
  mapCustomerToCRMPartner,
} from "../components/pms/pricing-costing/pricingApi";
import type { CRMPartner, PricingLocation } from "../components/pms/pricing-costing/types";
import type { TradeParameters } from "../types/tradeParameters";
import { fetchCustomers } from "./api";
import type { TradeTransitRequestLine } from "../utils/tradeTransitRequest";
import {
  applyPricingRecordToTradeTransitInputs,
  comparePricingRecordsForSelection,
  pickPricingLocation,
} from "../utils/tradeTransitPricingBridge";

export async function pullLatestPricingForLines(options: {
  lines: TradeTransitRequestLine[];
  parameters: TradeParameters;
  partners?: CRMPartner[];
  locations?: PricingLocation[];
}): Promise<TradeTransitRequestLine[]> {
  const { lines, parameters } = options;
  const linked = lines.filter((line) => line.chemicalTypeId);
  if (linked.length === 0) return lines;

  let partners = options.partners;
  if (!partners) {
    const res = await fetchCustomers({ limit: 1000 });
    partners = (res.customers ?? []).map(mapCustomerToCRMPartner);
  }

  const partner =
    (parameters.customerId
      ? partners.find((p) => p.id === parameters.customerId)
      : undefined) ??
    partners.find(
      (p) =>
        p.name.trim().toLowerCase() === parameters.clientName.trim().toLowerCase(),
    );
  if (!partner) return lines;

  const locations = options.locations ?? (await loadPricingLocations());
  const location = pickPricingLocation(locations, parameters);
  if (!location) return lines;

  const next = [...lines];
  for (const line of linked) {
    const records = await loadPricingRecords({
      crmPartnerId: partner.id,
      pmsProductId: line.chemicalTypeId!,
      limit: 20,
    });
    const sorted = [...records].sort(comparePricingRecordsForSelection);
    const active = sorted.find((row) => row.status === "active") ?? sorted[0];
    if (!active) continue;

    const patch = applyPricingRecordToTradeTransitInputs(
      active,
      line.inputs,
      parameters,
    );
    const index = next.findIndex((l) => l.id === line.id);
    if (index >= 0) {
      next[index] = {
        ...next[index]!,
        inputs: { ...next[index]!.inputs, ...patch },
      };
    }
  }

  return next;
}
