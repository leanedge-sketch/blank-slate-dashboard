import { describe, expect, it } from "vitest";
import {
  buildEditProductCostingPath,
  buildProductCostingLinePath,
  filterShipmentsForPipelineRequest,
  parseEditProductCostingSearchParams,
} from "./pipelineEditPaths";
import type { ImportShipmentRow } from "../services/importFinance";

describe("pipelineEditPaths", () => {
  it("builds edit URL with request ref and client", () => {
    const href = buildEditProductCostingPath({
      requestRef: "TT-2026-001",
      clientName: "Acme",
      customerId: "cust-1",
    });
    expect(href).toContain("/finance/product-costing?");
    expect(href).toContain("edit=1");
    expect(href).toContain("requestRef=TT-2026-001");
    expect(href).toContain("client=Acme");
    expect(href).toContain("customerId=cust-1");
  });

  it("builds product costing URL with line id", () => {
    const href = buildProductCostingLinePath("ttl-abc-123");
    expect(href).toContain("/finance/product-costing?");
    expect(href).toContain("line=ttl-abc-123");
  });

  it("parses edit search params", () => {
    const params = new URLSearchParams(
      "edit=1&requestRef=TT-99&client=Beta&customerId=abc",
    );
    expect(parseEditProductCostingSearchParams(params)).toEqual({
      requestRef: "TT-99",
      clientName: "Beta",
      customerId: "abc",
    });
  });

  it("filters shipments for a saved pipeline request", () => {
    const rows = [
      { request_ref: "TT-1", client_name: "A", customer_id: "c1" },
      { request_ref: "TT-1", client_name: "A", customer_id: "c1" },
      { request_ref: "TT-2", client_name: "B", customer_id: "c2" },
    ] as ImportShipmentRow[];

    const matched = filterShipmentsForPipelineRequest(rows, {
      requestRef: "TT-1",
      clientName: "A",
      customerId: "c1",
    });
    expect(matched).toHaveLength(2);
  });
});
