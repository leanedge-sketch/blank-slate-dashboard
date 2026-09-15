import { describe, expect, it } from "vitest";
import {
  formatRangeLabel,
  resolveDateRange,
  shipmentInRange,
} from "./executiveReportData";
import type { ImportShipmentRow } from "../../services/importFinance";

function row(overrides: Partial<ImportShipmentRow>): ImportShipmentRow {
  return {
    id: "1",
    product_id: "p1",
    quantity_kg: 1,
    supplier_base_price_usd: 1,
    supplier_margin_pct: 0,
    transport_to_border_usd: 0,
    snapshot_official_rate: 1,
    snapshot_parallel_rate: 1,
    local_clearance_per_kg_etb: 0,
    status: "draft",
    created_at: "2026-07-01T18:09:46.336136+00:00",
    request_date: "2026-07-01",
    ...overrides,
  };
}

describe("executive report date range", () => {
  it("all-time has no bounds so July shipments stay visible", () => {
    const range = resolveDateRange("all");
    expect(range.start).toBeNull();
    expect(range.end).toBeNull();
    expect(shipmentInRange(row({}), range)).toBe(true);
  });

  it("custom calendar range includes request_date inside the window", () => {
    const range = resolveDateRange("custom", {
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
    expect(shipmentInRange(row({}), range)).toBe(true);
    expect(
      shipmentInRange(row({ request_date: "2026-08-01", created_at: "2026-08-01T00:00:00Z" }), range),
    ).toBe(false);
  });

  it("labels custom dates like the analytics filter", () => {
    expect(formatRangeLabel("all")).toBe("All time");
    expect(
      formatRangeLabel("custom", { startDate: "2026-07-01", endDate: "2026-07-15" }),
    ).toBe("2026-07-01 to 2026-07-15");
  });
});
