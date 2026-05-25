"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosition } from "@/lib/store";

/**
 * Custom-scenario dialog: lets the user type precise shock values
 * (dS, dSigma in vol-pts, dDays) instead of using the sliders.
 *
 * - Pre-fills inputs with current shocks each time it opens.
 * - Validates against the slider bounds; shows inline errors and
 *   disables Apply if anything is out of range.
 * - On Apply: writes directly to the store (no clamping needed, since
 *   validation already guarantees in-range values).
 */
export function CustomScenarioDialog({
  active,
  bounds,
}: {
  active: boolean;
  bounds: {
    dSMin: number;
    dSMax: number;
    dSigmaMin: number; // decimal (e.g. -0.05)
    dSigmaMax: number;
    dDaysMin: number;
    dDaysMax: number;
  };
}) {
  const dS = usePosition((s) => s.dS);
  const dSigma = usePosition((s) => s.dSigma);
  const dDays = usePosition((s) => s.dDays);
  const setShocks = usePosition((s) => s.setShocks);

  const [open, setOpen] = useState(false);

  // String state so users can have transient empty/intermediate inputs
  // without the field jumping to "NaN".
  const [daysStr, setDaysStr] = useState("0");
  const [spotStr, setSpotStr] = useState("0");
  const [volPtsStr, setVolPtsStr] = useState("0");

  // Re-seed inputs from current store every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setDaysStr(String(dDays));
    setSpotStr(String(dS));
    setVolPtsStr((dSigma * 100).toFixed(1));
  }, [open, dDays, dS, dSigma]);

  // === Parsed numeric values + validation ===
  const days = Number(daysStr);
  const spot = Number(spotStr);
  const volPts = Number(volPtsStr);

  const volPtsMin = bounds.dSigmaMin * 100;
  const volPtsMax = bounds.dSigmaMax * 100;

  const daysError = validateInt(daysStr, bounds.dDaysMin, bounds.dDaysMax);
  const spotError = validateNum(spotStr, bounds.dSMin, bounds.dSMax);
  const volPtsError = validateNum(volPtsStr, volPtsMin, volPtsMax);

  const hasErrors = daysError !== null || spotError !== null || volPtsError !== null;

  function onApply() {
    if (hasErrors) return; // belt + suspenders; Apply is also disabled
    setShocks({ dS: spot, dSigma: volPts / 100, dDays: days });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
          />
        }
      >
        Custom scenario
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Custom scenario</DialogTitle>
        <DialogDescription>
          Type precise shock values to apply to the time machine. Pre-filled
          with your current sliders.
        </DialogDescription>

        <div className="space-y-4 py-2">
          <Field
            label="Days forward"
            value={daysStr}
            onChange={setDaysStr}
            step={1}
            hint={`${bounds.dDaysMin} – ${bounds.dDaysMax} days`}
            error={daysError}
          />
          <Field
            label="Spot shock ($)"
            value={spotStr}
            onChange={setSpotStr}
            step={0.5}
            hint={`${fmtRange(bounds.dSMin)} to ${fmtRange(bounds.dSMax)}`}
            error={spotError}
          />
          <Field
            label="IV shock (vol-points)"
            value={volPtsStr}
            onChange={setVolPtsStr}
            step={0.5}
            hint={`${fmtRange(volPtsMin, 1)} to ${fmtRange(volPtsMax, 1)}`}
            error={volPtsError}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onApply} disabled={hasErrors}>
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// === Helpers ===

function Field({
  label,
  value,
  onChange,
  step,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  hint: string;
  error: string | null;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      <Input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
      ) : (
        <p className="text-xs text-zinc-500">{hint}</p>
      )}
    </div>
  );
}

function validateInt(s: string, min: number, max: number): string | null {
  if (s.trim() === "") return "Required";
  const n = Number(s);
  if (!Number.isFinite(n)) return "Must be a number";
  if (!Number.isInteger(n)) return "Must be a whole number";
  if (n < min) return `Must be ≥ ${min}`;
  if (n > max) return `Must be ≤ ${max}`;
  return null;
}

function validateNum(s: string, min: number, max: number): string | null {
  if (s.trim() === "") return "Required";
  const n = Number(s);
  if (!Number.isFinite(n)) return "Must be a number";
  if (n < min) return `Must be ≥ ${fmtRange(min)}`;
  if (n > max) return `Must be ≤ ${fmtRange(max)}`;
  return null;
}

function fmtRange(n: number, decimals = 2): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(decimals)}`;
}
