import { SERVICE_FEE_CATEGORIES, type ServiceFeeCategory } from "@/lib/serviceFeeCategories";

// Optional live override, same pattern as loadFeeCategories.ts: publish a
// Google Sheet as CSV with columns main,label,biasaPct,khususPct and point
// NEXT_PUBLIC_SERVICE_SHEET_CSV at it to update Gratis Ongkir XTRA rates
// yourself, live, without a redeploy. Falls back to the baked-in table.
const SHEET_URL = process.env.NEXT_PUBLIC_SERVICE_SHEET_CSV;

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

function parseCsv(text: string): ServiceFeeCategory[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const iMain = header.indexOf("main");
  const iLabel = header.indexOf("label");
  const iBiasa = header.indexOf("biasapct");
  const iKhusus = header.indexOf("khususpct");
  if (iMain < 0 || iLabel < 0 || iBiasa < 0 || iKhusus < 0) return [];
  const rows: ServiceFeeCategory[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!);
    const biasaPct = Number(cols[iBiasa]);
    const khususPct = Number(cols[iKhusus]);
    if (!Number.isFinite(biasaPct) || !Number.isFinite(khususPct)) continue;
    rows.push({ main: cols[iMain] ?? "", label: cols[iLabel] ?? "", biasaPct, khususPct });
  }
  return rows;
}

export async function loadServiceFeeCategories(): Promise<ServiceFeeCategory[]> {
  if (!SHEET_URL) return SERVICE_FEE_CATEGORIES;
  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) return SERVICE_FEE_CATEGORIES;
    const parsed = parseCsv(await res.text());
    return parsed.length ? parsed : SERVICE_FEE_CATEGORIES;
  } catch {
    return SERVICE_FEE_CATEGORIES;
  }
}
