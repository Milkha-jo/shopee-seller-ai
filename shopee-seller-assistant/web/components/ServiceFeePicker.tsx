"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadServiceFeeCategories } from "@/lib/loadServiceFeeCategories";
import {
  SERVICE_FEE_CATEGORIES,
  SERVICE_CAP_BIASA,
  SERVICE_CAP_KHUSUS,
  type ServiceFeeCategory,
} from "@/lib/serviceFeeCategories";

const MAX_SHOWN = 40;

/**
 * Gratis Ongkir XTRA only charges a Service fee if the seller has actually
 * joined the program — so this defaults OFF. When off, Service stays at 0%
 * with no cap. When on, the seller searches their category and picks a
 * product size (Ukuran Biasa / Khusus) to fill the Service rate + its cap.
 */
export function ServiceFeePicker({
  onPick,
  onDisable,
}: {
  onPick: (pct: number, cap: number, label: string) => void;
  onDisable: () => void;
}) {
  const [enrolled, setEnrolled] = useState(false);
  const [cats, setCats] = useState<ServiceFeeCategory[]>(SERVICE_FEE_CATEGORIES);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadServiceFeeCategories().then((c) => {
      if (alive && c.length) setCats(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return cats
      .filter((c) => c.main.toLowerCase().includes(needle) || c.label.toLowerCase().includes(needle))
      .slice(0, MAX_SHOWN);
  }, [q, cats]);

  const toggle = (next: boolean) => {
    setEnrolled(next);
    setPicked(null);
    setQ("");
    if (!next) onDisable();
  };

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Truck className="h-4 w-4" /> Gratis Ongkir XTRA (Service fee)
        </Label>
        <label className="flex shrink-0 items-center gap-2 text-xs">
          <input type="checkbox" checked={enrolled} onChange={(e) => toggle(e.target.checked)} />
          I&rsquo;m enrolled in this program
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Only applies if you&rsquo;ve joined Gratis Ongkir XTRA (or Promo XTRA /
        Live XTRA). Leave unchecked and Service stays 0% — most sellers who
        haven&rsquo;t joined should leave this off.
      </p>

      {enrolled ? (
        <>
          <Input
            placeholder="Search your product category…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPicked(null);
            }}
          />
          {q.trim() && results.length === 0 ? (
            <p className="text-xs text-muted-foreground">No matches — try another word.</p>
          ) : null}
          {results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto rounded-md border bg-background">
              {results.map((c, idx) => (
                <div key={`${c.main}-${c.label}-${idx}`} className="border-b px-3 py-2 text-sm last:border-b-0">
                  <p className="truncate font-medium">{c.label}</p>
                  <p className="mb-1.5 text-xs text-muted-foreground">{c.main}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onPick(c.biasaPct, SERVICE_CAP_BIASA, `${c.main} — ${c.label} (Biasa)`);
                        setPicked(`${c.main} — ${c.label} (Ukuran Biasa)`);
                        setQ("");
                      }}
                      className="flex-1 rounded-md border px-2 py-1.5 text-left hover:bg-accent"
                    >
                      Ukuran Biasa: <b>{c.biasaPct}%</b>
                      <span className="block text-xs text-muted-foreground">
                        maks Rp{SERVICE_CAP_BIASA.toLocaleString("id-ID")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(c.khususPct, SERVICE_CAP_KHUSUS, `${c.main} — ${c.label} (Khusus)`);
                        setPicked(`${c.main} — ${c.label} (Ukuran Khusus)`);
                        setQ("");
                      }}
                      className="flex-1 rounded-md border px-2 py-1.5 text-left hover:bg-accent"
                    >
                      Ukuran Khusus: <b>{c.khususPct}%</b>
                      <span className="block text-xs text-muted-foreground">
                        maks Rp{SERVICE_CAP_KHUSUS.toLocaleString("id-ID")}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {picked ? (
            <p className="text-xs text-emerald-700">
              Service fee filled from: <b>{picked}</b>. Adjust below if needed.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
