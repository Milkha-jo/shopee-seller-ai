import { describe, it, expect } from "vitest";
import { SERVICE_FEE_CATEGORIES, SERVICE_CAP_BIASA, SERVICE_CAP_KHUSUS } from "@/lib/serviceFeeCategories";

describe("SERVICE_FEE_CATEGORIES (baked Gratis Ongkir XTRA fees)", () => {
  it("has the full parsed category set", () => {
    expect(SERVICE_FEE_CATEGORIES.length).toBeGreaterThan(250);
  });
  it("every entry has sane biasa/khusus percentages (khusus >= biasa)", () => {
    for (const c of SERVICE_FEE_CATEGORIES) {
      expect(c.biasaPct).toBeGreaterThan(0);
      expect(c.khususPct).toBeGreaterThanOrEqual(c.biasaPct);
      expect(c.khususPct).toBeLessThanOrEqual(100);
    }
  });
  it("caps match Shopee's fixed maximums", () => {
    expect(SERVICE_CAP_BIASA).toBe(40000);
    expect(SERVICE_CAP_KHUSUS).toBe(60000);
  });
});
