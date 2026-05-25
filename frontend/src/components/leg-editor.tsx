"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePosition, type Leg } from "@/lib/store";

/** DTE field: real expiry dropdown when a ticker is loaded, free-text otherwise. */
function ExpiryField({ leg }: { leg: Leg }) {
  const updateLeg = usePosition((s) => s.updateLeg);
  const availableExpiries = usePosition((s) => s.availableExpiries);

  if (availableExpiries.length === 0) {
    // No ticker loaded — free-text DTE
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          DTE
        </label>
        <Input
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          value={leg.expiry_days}
          onChange={(e) =>
            updateLeg(leg.id, { expiry_days: Number(e.target.value) })
          }
        />
      </div>
    );
  }

  // Ticker loaded — real expiry dropdown
  const value = String(leg.expiry_days);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wide text-zinc-500">
        Expiry
      </label>
      <Select
        value={value}
        onValueChange={(v) =>
          updateLeg(leg.id, { expiry_days: Number(v) })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableExpiries.map((e) => (
            <SelectItem key={e.date} value={String(e.days_to_expiry)}>
              {e.date} ({e.days_to_expiry}d)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}


/** Single-leg row: kind, strike, DTE, quantity, premium, remove. */
export function LegEditor({
  leg,
  pricePerShare,
}: {
  leg: Leg;
  /** Per-share BS price; undefined while the per-leg-prices query is loading. */
  pricePerShare?: number;
}) {
  const updateLeg = usePosition((s) => s.updateLeg);
  const removeLeg = usePosition((s) => s.removeLeg);

  // Per-contract dollar cost (positive = debit you pay, negative = credit you collect).
  const legCost =
    pricePerShare !== undefined
      ? pricePerShare * 100 * leg.quantity
      : undefined;

  return (
    <div className="grid grid-cols-[110px_80px_80px_80px_minmax(140px,1fr)_auto] items-end gap-3">
      {/* Kind */}
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Side
        </label>
        <Select
          value={leg.kind}
          onValueChange={(v) => updateLeg(leg.id, { kind: v as "call" | "put" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="put">Put</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Strike */}
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Strike
        </label>
        <Input
          type="number"
          inputMode="decimal"
          step="1"
          min="0"
          value={leg.strike}
          onChange={(e) =>
            updateLeg(leg.id, { strike: Number(e.target.value) })
          }
        />
      </div>

      {/* Days to expiry — dropdown of real expiries if a ticker is loaded,
          otherwise free-text DTE input. */}
      <ExpiryField leg={leg} />


      {/* Quantity */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs uppercase tracking-wide text-zinc-500"
          title="Negative = short"
        >
          Qty
        </label>
        <Input
          type="number"
          inputMode="numeric"
          step="1"
          value={leg.quantity}
          onChange={(e) =>
            updateLeg(leg.id, { quantity: Number(e.target.value) })
          }
        />
      </div>

      {/* Premium (read-only) — per-share mid + per-contract leg cost */}
      <div
        className="flex flex-col gap-1"
        title="Per-share Black-Scholes price; per-leg dollar cost = price × 100 × qty (positive = debit you pay, negative = credit you collect)."
      >
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Premium
        </label>
        <div className="flex h-9 flex-col justify-center rounded-md border border-input bg-muted/40 px-3 text-sm">
          {pricePerShare === undefined ? (
            <span className="text-zinc-400">—</span>
          ) : (
            <>
              <span className="font-mono leading-tight">
                ${pricePerShare.toFixed(2)}/sh
              </span>
              {legCost !== undefined && leg.quantity !== 0 && (
                <span
                  className={`font-mono text-xs leading-tight ${
                    legCost >= 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  ${Math.abs(legCost).toFixed(2)}{" "}
                  {legCost >= 0 ? "debit" : "credit"}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Remove */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Remove leg"
        onClick={() => removeLeg(leg.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
