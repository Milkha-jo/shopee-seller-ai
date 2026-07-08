import { describe, it, expect } from "vitest";
import { FEE_CATEGORIES } from "@/lib/feeCategories";

describe("FEE_CATEGORIES (baked Shopee admin fees)", () => {
  it("has the full parsed category set", () => {
    expect(FEE_CATEGORIES.length).toBeGreaterThan(250);
  });
  it("every entry has a main, label and a sane percentage", () => {
    for (const c of FEE_CATEGORIES) {
      expect(typeof c.main).toBe("string");
      expect(c.main.length).toBeGreaterThan(0);
      expect(typeof c.label).toBe("string");
      expect(c.pct).toBeGreaterThan(0);
      expect(c.pct).toBeLessThanOrEqual(100);
    }
  });
  it("covers the four main groups", () => {
    const mains = new Set(FEE_CATEGORIES.map((c) => c.main));
    for (const m of ["Fashion", "FMCG", "Elektronik", "Lifestyle"]) {
      expect(mains.has(m)).toBe(true);
    }
  });
});
