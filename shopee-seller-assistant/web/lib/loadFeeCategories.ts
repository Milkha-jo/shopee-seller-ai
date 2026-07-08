import { FEE_CATEGORIES, type FeeCategory } from "@/lib/feeCategories";

// Optional live override: if NEXT_PUBLIC_FEE_SHEET_CSV points at a published
// Google Sheet (File → Share → Publish to web → CSV), the picker reads that
// instead of the baked-in table — so you can update fees yourself, no redeploy.
// Expected columns (header row): main,label,pct   (pct as a number, e.g. 9 or 8.25)
// Falls back to the baked-in data on any problem.
const SHEET_URL = process.env.NEXT_PUBLIC_FEE_SHEET_CSV;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): FeeCategory[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const iMain = header.indexOf("main");
  const iLabel = header.indexOf("label");
  const iPct = header.indexOf("pct");
  if (iMain < 0 || iLabel < 0 || iPct < 0) return [];
  const rows: FeeCategory[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!);
    const pct = Number(cols[iPct]);
    if (!Number.isFinite(pct)) continue;
    rows.push({ main: cols[iMain] ?? "", label: cols[iLabel] ?? "", pct });
  }
  return rows;
}

export async function loadFeeCategories(): Promise<FeeCategory[]> {
  if (!SHEET_URL) return FEE_CATEGORIES;
  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) return FEE_CATEGORIES;
    const parsed = parseCsv(await res.text());
    return parsed.length ? parsed : FEE_CATEGORIES;
  } catch {
    return FEE_CATEGORIES;
  }
}
