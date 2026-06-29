// Pure presentation helpers. These format values the BACKEND already computed —
// they never derive fees, profit, margin, markup, break-even or recommendations.

/** Format a backend rupiah string/number as "Rp1.234.567". */
export function formatIDR(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format a backend decimal ratio string (e.g. "0.44") as a percentage "44%". */
export function formatPercent(value: string | null | undefined, digits = 1): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

/** Format a backend decimal ratio as plain percent number (for charts). */
export function toPercentNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n * 100 : null;
}

/** Plain rupiah number for charts/axes (parses a backend string). */
export function toNumber(value: string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const TIER_LABELS: Record<string, string> = {
  REGULAR: "Regular",
  STAR: "Star",
  STAR_PLUS: "Star+",
  MALL: "Mall",
};
export const tierLabel = (t: string): string => TIER_LABELS[t] ?? t;

const FEE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  SERVICE: "Service",
  PAYMENT: "Payment",
};
export const feeLabel = (t: string): string => FEE_LABELS[t] ?? t;

export const todayIso = (): string => new Date().toISOString().slice(0, 10);
