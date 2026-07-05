"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChainPickerDialog } from "@/components/chain-picker-dialog";
import { usePosition, type Leg } from "@/lib/store";

/** Shared grid template — keep in sync between header (in strategy-builder)
 *  and every leg row so columns line up. */
export const LEG_GRID =
  "grid grid-cols-[100px_72px_96px_56px_72px_minmax(150px,1fr)_auto] items-start gap-2";

/** DTE field: real expiry dropdown when a ticker is loaded, free-text otherwise. */
function ExpiryField({ leg }: { leg: Leg }) {
  const updateLeg = usePosition((s) => s.updateLeg);
  const availableExpiries = usePosition((s) => s.availableExpiries);

  if (leg.kind === "stock") return <DisabledCell label="Expiry" />;

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
          value={leg.expiry_days ?? 0}
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

/** Grayed-out placeholder for fields that don't apply to stock legs. */
function DisabledCell({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wide text-zinc-400">
        {label}
      </label>
      <div className="flex h-9 items-center rounded-md border border-dashed border-zinc-200 px-3 text-sm text-zinc-300 dark:border-zinc-800 dark:text-zinc-700">
        —
      </div>
    </div>
  );
}

/** Single-leg row: kind, strike, expiry, qty, IV, premium (editable), remove. */
export function LegEditor({
  leg,
  pricePerShare,
}: {
  leg: Leg;
  /** Per-share model price; undefined while the per-leg-prices query is loading. */
  pricePerShare?: number;
}) {
  const updateLeg = usePosition((s) => s.updateLeg);
  const removeLeg = usePosition((s) => s.removeLeg);
  const positionSigma = usePosition((s) => s.sigma);
  const S = usePosition((s) => s.S);

  const isStock = leg.kind === "stock";

  // Effective premium per share: user's entry if set, else model price.
  const effectivePrice = leg.entry_price ?? pricePerShare;
  const legCost =
    effectivePrice !== undefined
      ? effectivePrice * 100 * leg.quantity
      : undefined;

  function onKindChange(v: string | null) {
    if (v == null) return;
    if (v === "stock") {
      // Strike/expiry/IV/entry don't apply to shares
      updateLeg(leg.id, {
        kind: "stock",
        strike: 0,
        expiry_days: 0,
        sigma: undefined,
        entry_price: undefined,
      });
    } else {
      updateLeg(leg.id, {
        kind: v as "call" | "put",
        // Coming FROM stock: seed sensible option fields near ATM
        ...(isStock ? { strike: Math.round(S / 5) * 5, expiry_days: 30 } : {}),
      });
    }
  }

  return (
    <div className={LEG_GRID}>
      {/* Kind */}
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Side
        </label>
        <Select value={leg.kind} onValueChange={onKindChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="put">Put</SelectItem>
            <SelectItem value="stock">Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Strike — with a "chain" shortcut when a ticker is loaded */}
      {isStock ? (
        <DisabledCell label="Strike" />
      ) : (
        <div className="flex flex-col gap-1">
          <label className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500">
            <span>Strike</span>
            <ChainPickerDialog leg={leg} />
          </label>
          <Input
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={leg.strike ?? 0}
            onChange={(e) =>
              updateLeg(leg.id, { strike: Number(e.target.value) })
            }
          />
        </div>
      )}

      {/* Expiry */}
      <ExpiryField leg={leg} />

      {/* Quantity */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs uppercase tracking-wide text-zinc-500"
          title={
            isStock
              ? "1 = 100 shares. Negative = short."
              : "Contracts. Negative = short."
          }
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
        {isStock && (
          <span className="text-[10px] leading-tight text-zinc-400">
            ×100 sh
          </span>
        )}
      </div>

      {/* Per-leg IV (%) — blank inherits position IV */}
      {isStock ? (
        <DisabledCell label="IV %" />
      ) : (
        <div
          className="flex flex-col gap-1"
          title="This leg's implied volatility. Leave blank to use the position-level IV. Auto-filled when picking a strike from the chain."
        >
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            IV %
          </label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={leg.sigma != null ? +(leg.sigma * 100).toFixed(2) : ""}
            placeholder={(positionSigma * 100).toFixed(1)}
            onChange={(e) => {
              const raw = e.target.value;
              updateLeg(leg.id, {
                sigma: raw === "" ? undefined : Number(raw) / 100,
              });
            }}
          />
        </div>
      )}

      {/* Premium — EDITABLE entry price per share. Placeholder = model price.
          Small reset appears when the user has overridden it. */}
      <div
        className="flex flex-col gap-1"
        title="Your actual fill per share. Defaults to the model price; edit to match your broker statement. Cost basis, max profit/loss and breakevens use this."
      >
        <label className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500">
          <span>{isStock ? "Entry/sh" : "Premium/sh"}</span>
          {leg.entry_price != null && (
            <button
              type="button"
              onClick={() => updateLeg(leg.id, { entry_price: undefined })}
              title="Reset to model price"
              className="inline-flex items-center gap-0.5 normal-case text-red-900 hover:underline dark:text-red-400"
            >
              <RotateCcw className="h-3 w-3" />
              model
            </button>
          )}
        </label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={leg.entry_price != null ? leg.entry_price : ""}
          placeholder={
            pricePerShare !== undefined ? pricePerShare.toFixed(2) : "—"
          }
          onChange={(e) => {
            const raw = e.target.value;
            updateLeg(leg.id, {
              entry_price: raw === "" ? undefined : Number(raw),
            });
          }}
        />
        {legCost !== undefined && leg.quantity !== 0 && (
          <span
            className={`font-mono text-[11px] leading-tight ${
              legCost >= 0
                ? "text-red-700 dark:text-red-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            ${Math.abs(legCost).toFixed(2)} {legCost >= 0 ? "debit" : "credit"}
          </span>
        )}
      </div>

      {/* Remove */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Remove leg"
        className="mt-5"
        onClick={() => removeLeg(leg.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
