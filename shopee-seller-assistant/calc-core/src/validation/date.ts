/**
 * Internal date validation helper (validation module only).
 * Confirms a string is a real 'YYYY-MM-DD' calendar date.
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [ys, ms, ds] = value.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Reject impossible dates (e.g. 2026-02-30) via UTC round-trip.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Sentinel for an open-ended (null) effective window, for date-string compares. */
export const OPEN_ENDED = '9999-12-31';
