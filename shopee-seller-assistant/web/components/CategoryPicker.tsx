"use client";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadFeeCategories } from "@/lib/loadFeeCategories";
import { FEE_CATEGORIES, type FeeCategory } from "@/lib/feeCategories";

const MAX_SHOWN = 40;

export function CategoryPicker({
  onPick,
}: {
  onPick: (pct: number, label: string) => void;
}) {
  const [cats, setCats] = useState<FeeCategory[]>(FEE_CATEGORIES);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadFeeCategories().then((c) => {
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
      .filter(
        (c) =>
          c.main.toLowerCase().includes(needle) ||
          c.label.toLowerCase().includes(needle),
      )
      .slice(0, MAX_SHOWN);
  }, [q, cats]);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <Label className="flex items-center gap-1.5 text-sm font-medium">
        <Search className="h-4 w-4" /> Quick-fill Admin fee by category
      </Label>
      <p className="text-xs text-muted-foreground">
        Type your product/category (e.g. &ldquo;audio&rdquo;, &ldquo;pakaian
        wanita&rdquo;) and pick a match. It fills the <b>Admin</b> rate only —
        Service &amp; Payment stay manual, and admin is free while you&rsquo;re a
        new Non-Star seller.
      </p>
      <Input
        placeholder="Search category…"
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
        <div className="max-h-56 overflow-y-auto rounded-md border bg-background">
          {results.map((c, idx) => (
            <button
              key={`${c.main}-${c.label}-${idx}`}
              type="button"
              onClick={() => {
                onPick(c.pct, `${c.main} — ${c.label}`);
                setPicked(`${c.main} — ${c.label}`);
                setQ("");
              }}
              className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.label}</span>
                <span className="block text-xs text-muted-foreground">{c.main}</span>
              </span>
              <span className="shrink-0 font-semibold">{c.pct}%</span>
            </button>
          ))}
        </div>
      ) : null}
      {picked ? (
        <p className="text-xs text-emerald-700">
          Admin fee filled from: <b>{picked}</b>. Adjust below if needed.
        </p>
      ) : null}
    </div>
  );
}
