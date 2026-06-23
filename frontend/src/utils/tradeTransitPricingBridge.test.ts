import { describe, expect, it } from "vitest";
import type { PricingRecord } from "../components/pms/pricing-costing/types";
import { DEFAULT_TRADE_PARAMETERS } from "../types/tradeParameters";
import {
  applyPricingRecordToTradeTransitInputs,
  buildTradeTransitSnapshotIndex,
  resolveCrmPartnerByClientName,
  tradeTransitSnapshotKey,
} from "./tradeTransitPricingBridge";
import { DEFAULT_TRADE_TRANSIT_INPUTS } from "./tradeTransitCalc";

describe("tradeTransitPricingBridge", () => {
  it("resolves CRM buyer by client name", () => {
    const partner = resolveCrmPartnerByClientName(
      [
        {
          id: "c1",
          name: "Acme Trading PLC",
          type: "buyer",
          partnerKind: "crm",
        },
      ],
      "acme trading plc",
    );
    expect(partner?.id).toBe("c1");
  });

  it("indexes latest trade transit shipment per client and product", () => {
    const map = buildTradeTransitSnapshotIndex([
      {
        id: "1",
        product_id: "p1",
        quantity_kg: 1000,
        supplier_base_price_usd: 1,
        supplier_margin_pct: 0,
        transport_to_border_usd: 0,
        snapshot_official_rate: 130,
        snapshot_parallel_rate: 190,
        local_clearance_per_kg_etb: 20,
        final_landed_unit_cost_etb_per_kg: 275.5,
        target_selling_price_etb_per_kg: 320,
        client_name: "Acme Trading",
        request_ref: "REQ-1",
        chemical_type_id: "chem-uuid",
        status: "draft",
        created_at: "2026-06-01T00:00:00Z",
      },
    ]);

    const key = tradeTransitSnapshotKey("Acme Trading", "chem-uuid");
    expect(map.get(key)?.landedCostEtbPerKg).toBe(275.5);
    expect(map.get(key)?.sellingPriceEtbPerKg).toBe(320);
  });

  it("maps active pricing record into trade transit supplier and sell inputs", () => {
    const record: PricingRecord = {
      id: "r1",
      crmPartnerId: "c1",
      partnerKind: "crm",
      pmsProductId: "chem-1",
      incoterm: "FOB",
      locationId: "loc-1",
      costCurrency: "USD",
      costAmount: 0.95,
      priceCurrency: "ETB",
      priceAmount: 310,
      needsCurrencyConversion: true,
      exchangeRateUsed: 190,
      baseCurrency: "USD",
      validFrom: "2026-06-01",
      validTo: null,
      status: "active",
    };

    const patch = applyPricingRecordToTradeTransitInputs(
      record,
      DEFAULT_TRADE_TRANSIT_INPUTS,
      DEFAULT_TRADE_PARAMETERS,
    );

    expect(patch.supplierBasePriceUsd).toBe(0.95);
    expect(patch.targetSellingPriceEtbPerKg).toBe(310);
    expect(patch.sellingPriceMode).toBe("manual");
  });
});
