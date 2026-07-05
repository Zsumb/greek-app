"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { api, type ChainRow } from "@/lib/api";
import { usePosition, type Leg } from "@/lib/store";

/**
 * Chain picker — classic straddle view (calls left, strike center, puts
 * right). Clicking a side fills the leg with that contract's strike, real
 * expiry, chain IV, and mid as the entry premium.
 *
 * Only rendered when a ticker is loaded (real expiries exist).
 */
export function ChainPickerDialog({ leg }: { leg: Leg }) {
  const [open, setOpen] = useState(false);

  const ticker = usePosition((s) => s.ticker);
  const S = usePosition((s) => s.S);
  const availableExpiries = usePosition((s) => s.availableExpiries);
  const updateLeg = usePosition((s) => s.updateLeg);

  // Default the dialog to the leg's current expiry when it matches a real
  // one; otherwise the first non-0DTE expiry.
  const defaultExpiry =
    availableExpiries.find((e) => e.days_to_expiry === leg.expiry_days)?.date ??
    availableExpiries.find((e) => e.days_to_expiry >= 1)?.date ??
    availableExpiries[0]?.date;
  const [expiry, setExpiry] = useState<string | undefined>(undefined);
  const activeExpiry = expiry ?? defaultExpiry;

  const chainQuery = useQuery({
    queryKey: ["chain-full", ticker, activeExpiry],
    queryFn: () => api.chainFull(ticker!, activeExpiry!),
    enabled: open && !!ticker && !!activeExpiry,
    staleTime: 5 * 60_000, // server caches per day; UI cache 5 min is plenty
    retry: 1,
  });

  // Merge calls/puts by strike, keep strikes within ±20% of spot to keep
  // the table tractable (SPY has hundreds of strikes).
  const rows = useMemo(() => {
    const chain = chainQuery.data;
    if (!chain) return [];
    const byStrike = new Map<number, { call?: ChainRow; put?: ChainRow }>();
    for (const c of chain.calls) {
      if (Math.abs(c.strike - S) / S > 0.2) continue;
      byStrike.set(c.strike, { ...byStrike.get(c.strike), call: c });
    }
    for (const p of chain.puts) {
      if (Math.abs(p.strike - S) / S > 0.2) continue;
      byStrike.set(p.strike, { ...byStrike.get(p.strike), put: p });
    }
    return [...byStrike.entries()]
      .sort(([a], [b]) => a - b)
      .map(([strike, sides]) => ({ strike, ...sides }));
  }, [chainQuery.data, S]);

  // Nearest strike to spot — highlighted as the ATM row
  const atmStrike = useMemo(() => {
    if (rows.length === 0) return undefined;
    return rows.reduce((a, b) =>
      Math.abs(b.strike - S) < Math.abs(a.strike - S) ? b : a,
    ).strike;
  }, [rows, S]);

  function pick(kind: "call" | "put", row: ChainRow) {
    const dte = availableExpiries.find((e) => e.date === activeExpiry)
      ?.days_to_expiry;
    updateLeg(leg.id, {
      kind,
      strike: row.strike,
      ...(dte !== undefined ? { expiry_days: dte } : {}),
      sigma: row.iv > 0.01 ? row.iv : undefined,
      entry_price: row.mid > 0 ? row.mid : undefined,
    });
    setOpen(false);
  }

  if (!ticker || availableExpiries.length === 0 || leg.kind === "stock") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Pick a real contract from the option chain"
        className="inline-flex items-center gap-0.5 text-[10px] font-semibold normal-case text-red-900 hover:underline dark:text-red-400"
      >
        <Link2 className="h-3 w-3" />
        chain
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle className="flex items-center gap-2">
            {ticker} option chain
            {chainQuery.isLoading && (
              <Badge variant="secondary" className="font-normal">
                loading…
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Click a call (left) or put (right) to fill this leg with its
            strike, expiry, chain IV, and mid price as your entry.
          </DialogDescription>

          {/* Expiry selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Expiry
            </span>
            <Select
              value={activeExpiry}
              onValueChange={(v) => v && setExpiry(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableExpiries.map((e) => (
                  <SelectItem key={e.date} value={e.date}>
                    {e.date} ({e.days_to_expiry}d)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {chainQuery.isError && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              Couldn&apos;t fetch the chain —{" "}
              <span className="font-mono text-xs">
                {(chainQuery.error as Error).message}
              </span>
            </div>
          )}

          {rows.length > 0 && (
            <div className="max-h-[55vh] overflow-y-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-right font-mono text-xs">
                <thead className="sticky top-0 bg-zinc-100 font-sans dark:bg-zinc-900">
                  <tr className="text-[10px] uppercase tracking-wide text-zinc-500">
                    <th colSpan={4} className="px-2 py-1.5 text-center">
                      Calls
                    </th>
                    <th className="bg-zinc-200/70 px-2 py-1.5 text-center dark:bg-zinc-800">
                      Strike
                    </th>
                    <th colSpan={4} className="px-2 py-1.5 text-center">
                      Puts
                    </th>
                  </tr>
                  <tr className="text-[10px] uppercase tracking-wide text-zinc-500">
                    <th className="px-2 py-1">Bid</th>
                    <th className="px-2 py-1">Mid</th>
                    <th className="px-2 py-1">Ask</th>
                    <th className="px-2 py-1">IV%</th>
                    <th className="bg-zinc-200/70 px-2 py-1 text-center dark:bg-zinc-800" />
                    <th className="px-2 py-1">IV%</th>
                    <th className="px-2 py-1">Bid</th>
                    <th className="px-2 py-1">Mid</th>
                    <th className="px-2 py-1">Ask</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isAtm = row.strike === atmStrike;
                    return (
                      <tr
                        key={row.strike}
                        className={`border-t border-zinc-100 dark:border-zinc-800 ${
                          isAtm ? "bg-red-900/5 dark:bg-red-400/10" : ""
                        }`}
                      >
                        {/* Calls side — one click target */}
                        <SideCells
                          row={row.call}
                          onPick={() => row.call && pick("call", row.call)}
                          align="left"
                        />
                        <td className="bg-zinc-100/80 px-2 py-1 text-center font-semibold dark:bg-zinc-900">
                          {row.strike}
                          {isAtm && (
                            <span className="ml-1 font-sans text-[9px] text-red-900 dark:text-red-400">
                              ATM
                            </span>
                          )}
                        </td>
                        {/* Puts side */}
                        <SideCells
                          row={row.put}
                          onPick={() => row.put && pick("put", row.put)}
                          align="right"
                        />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-zinc-400">
            15-minute-delayed data via yfinance. Mid = (bid+ask)/2 when both
            sides quote. ATM row highlighted. Strikes shown: ±20% of spot.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** One side (call or put) of a chain row — 4 clickable cells. */
function SideCells({
  row,
  onPick,
  align,
}: {
  row?: ChainRow;
  onPick: () => void;
  align: "left" | "right";
}) {
  if (!row) {
    return (
      <>
        <td className="px-2 py-1 text-zinc-300 dark:text-zinc-700">—</td>
        <td className="px-2 py-1 text-zinc-300 dark:text-zinc-700">—</td>
        <td className="px-2 py-1 text-zinc-300 dark:text-zinc-700">—</td>
        <td className="px-2 py-1 text-zinc-300 dark:text-zinc-700">—</td>
      </>
    );
  }
  const cellCls =
    "px-2 py-1 cursor-pointer group-hover/side:bg-red-900/10";
  const ivPct = row.iv > 0.01 ? (row.iv * 100).toFixed(1) : "—";
  // Order flips so IV sits nearest the strike column on both sides
  const cells =
    align === "left"
      ? [row.bid.toFixed(2), row.mid.toFixed(2), row.ask.toFixed(2), ivPct]
      : [ivPct, row.bid.toFixed(2), row.mid.toFixed(2), row.ask.toFixed(2)];
  return (
    <>
      {cells.map((v, i) => (
        <td
          key={i}
          onClick={onPick}
          title="Click to fill this leg"
          className={`${cellCls} transition-colors hover:bg-red-900/10 dark:hover:bg-red-400/10`}
        >
          {v}
        </td>
      ))}
    </>
  );
}
