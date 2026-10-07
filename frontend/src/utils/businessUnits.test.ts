import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_UNITS, mergeBusinessUnitOptions } from "./businessUnits";

describe("business unit options", () => {
  it("includes Synresins in the seeded list", () => {
    expect(DEFAULT_BUSINESS_UNITS).toContain("Synresins");
  });

  it("merges seeded, fetched, and current values without duplicates", () => {
    const merged = mergeBusinessUnitOptions(
      ["Synresins", "East Africa Resins"],
      "Hayat",
    );
    expect(merged).toContain("Hayat");
    expect(merged).toContain("Synresins");
    expect(merged).toContain("East Africa Resins");
    expect(merged.filter((name) => name.toLowerCase() === "synresins")).toHaveLength(
      1,
    );
  });
});
