import { describe, it, expect } from "vitest";
import {
  formatIDR,
  formatPercent,
  toPercentNumber,
  toNumber,
  tierLabel,
  feeLabel,
  todayIso,
} from "@/lib/format";

describe("formatIDR", () => {
  it("formats rupiah strings without decimals", () => {
    expect(formatIDR("100000")).toContain("100.000");
    expect(formatIDR(48000)).toContain("48.000");
  });
  it("returns dash for empty/invalid", () => {
    expect(formatIDR("")).toBe("—");
    expect(formatIDR(null)).toBe("—");
    expect(formatIDR("abc")).toBe("—");
  });
});

describe("formatPercent / toPercentNumber", () => {
  it("converts decimal ratio to percent", () => {
    expect(formatPercent("0.44")).toBe("44.0%");
    expect(formatPercent("0.0825", 2)).toBe("8.25%");
  });
  it("handles null", () => {
    expect(formatPercent(null)).toBe("—");
    expect(toPercentNumber(null)).toBeNull();
    expect(toPercentNumber("0.5")).toBe(50);
  });
});

describe("toNumber", () => {
  it("parses or defaults to 0", () => {
    expect(toNumber("123")).toBe(123);
    expect(toNumber("")).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber("x")).toBe(0);
  });
});

describe("labels", () => {
  it("maps tiers and fees", () => {
    expect(tierLabel("STAR_PLUS")).toBe("Star+");
    expect(tierLabel("UNKNOWN")).toBe("UNKNOWN");
    expect(feeLabel("ADMIN")).toBe("Admin");
    expect(feeLabel("XYZ")).toBe("XYZ");
  });
});

describe("todayIso", () => {
  it("returns YYYY-MM-DD", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
