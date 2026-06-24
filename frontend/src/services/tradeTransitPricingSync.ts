import {
  createPricingRecordApi,
  loadPricingRecords,
  revisePricingRecordApi,
} from "../components/pms/pricing-costing/pricingApi";
import type { CRMPartner, PricingLocation } from "../components/pms/pricing-costing/types";
import type { TradeParameters } from "../types/tradeParameters";
import { calculateTradeTransit } from "../utils/tradeTransitCalc";
import type { FinanceConstants } from "../utils/importFinanceCalc";
import type { TradeTransitRequestLine } from "../utils/tradeTransitRequest";
import {
  buildPricingRecordFromTradeTransitLine,
  comparePricingRecordsForSelection,
  pickPricingLocation,
  resolveCrmPartnerByClientName,
} from "../utils/tradeTransitPricingBridge";

export type TradeTransitPricingSyncResult = {
  synced: number;
  skipped: string[];
  errors: string[];
};

export async function syncTradeTransitLinesToPricing(options: {
  lines: TradeTransitRequestLine[];
  clientName: string;
  parameters: TradeParameters;
  partners: CRMPartner[];
  locations: PricingLocation[];
  constants: FinanceConstants;
}): Promise<TradeTransitPricingSyncResult> {
  const { lines, clientName, parameters, partners, locations, constants } = options;
  const result: TradeTransitPricingSyncResult = {
    synced: 0,
    skipped: [],
    errors: [],
  };

  const partner =
    (parameters.customerId
      ? partners.find((p) => p.id === parameters.customerId)
      : undefined) ?? resolveCrmPartnerByClientName(partners, clientName);
  if (!partner) {
    result.skipped.push(
      `No CRM buyer match for client "${clientName}" — pricing not updated.`,
    );
    return result;
  }

  const location = pickPricingLocation(locations, parameters);
  if (!location) {
    result.skipped.push("No pricing location configured — run pricing junction SQL.");
    return result;
  }

  const linked = lines.filter((line) => line.chemicalTypeId);
  if (linked.length === 0) {
    result.skipped.push("No PMS-linked product lines to sync.");
    return result;
  }

  for (const line of linked) {
    try {
      const calc = calculateTradeTransit(line.inputs, constants);
      const input = buildPricingRecordFromTradeTransitLine(
        line,
        calc,
        partner,
        location,
        parameters,
      );

      const existing = await loadPricingRecords({
        crmPartnerId: partner.id,
        pmsProductId: line.chemicalTypeId!,
        limit: 20,
      });
      const sorted = [...existing].sort(comparePricingRecordsForSelection);
      const active = sorted.find((row) => row.status === "active") ?? sorted[0];

      if (active) {
        await revisePricingRecordApi(active.id, input, { offerUpdateOpenDeals: false });
      } else {
        await createPricingRecordApi(input);
      }
      result.synced += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${line.productName}: ${message}`);
    }
  }

  return result;
}
