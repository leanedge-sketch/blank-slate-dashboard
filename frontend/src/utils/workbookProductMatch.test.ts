import { describe, expect, it } from "vitest";
import type { ChemicalFullData } from "../services/api";
import {
  bestCatalogMatch,
  scoreProductMatch,
  suggestCatalogProducts,
} from "./workbookProductMatch";

function chemical(partial: Partial<ChemicalFullData>): ChemicalFullData {
  return {
    id: 1,
    product_name: "Metacel RDP",
    vendor: "Dow",
    ...partial,
  } as ChemicalFullData;
}

describe("workbookProductMatch", () => {
  it("scores exact and partial product name matches", () => {
    const row = chemical({ product_name: "Metacel RDP", vendor: "Dow" });
    expect(scoreProductMatch("Metacel RDP", row)).toBe(100);
    expect(scoreProductMatch("Metacel", row)).toBeGreaterThanOrEqual(70);
  });

  it("suggests similar catalog products", () => {
    const catalog = [
      chemical({ id: 1, product_name: "Metacel RDP", vendor: "Dow" }),
      chemical({ id: 2, product_name: "Cellocel", vendor: "Ashland" }),
    ];
    const suggestions = suggestCatalogProducts("Metacel", catalog, 3);
    expect(suggestions[0]?.chemical.product_name).toBe("Metacel RDP");
    expect(bestCatalogMatch("Metacel RDP", catalog)?.product_name).toBe(
      "Metacel RDP",
    );
  });
});
