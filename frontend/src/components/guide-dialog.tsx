"use client";

import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** "Guide" button in the header → opens a modal with a step-by-step walkthrough. */
export function GuideDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="w-full border-red-900 text-red-900 hover:bg-red-50 hover:text-red-900 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-400"
          />
        }
      >
        <HelpCircle className="mr-2 h-4 w-4" />
        User guide
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How to use this tool</DialogTitle>
          <DialogDescription>
            A 6-step walkthrough — ~2 minutes.
          </DialogDescription>
        </DialogHeader>

        <ol className="mt-2 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              1. Build a position.
            </strong>{" "}
            Use a preset (Long Call, Iron Condor, …) or click <em>Add leg</em> for
            custom. Each leg = call/put + strike + days-to-expiry + qty (negative
            qty = short).
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              2. Fetch real market data (optional).
            </strong>{" "}
            Type a US ticker → backend pulls live spot, expiries, and ATM IV from
            yfinance. After fetching, the <strong>DTE</strong> field becomes a
            real expiry-date dropdown.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              3. Read the Live Greeks.
            </strong>{" "}
            Right panel shows Δ, Γ, Θ, Vega, Rho aggregated across legs. Green =
            positive, red = negative. Numbers are <strong>per contract</strong>{" "}
            (×100 shares).
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              4. Inspect the payoff.
            </strong>{" "}
            Solid green line = P&amp;L at expiration. Dotted blue line = P&amp;L
            today (still has time value). Dashed vertical = current spot; dotted
            verticals = breakevens.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              5. Run scenarios in the Time Machine.
            </strong>{" "}
            Three sliders: <strong>Days forward</strong>,{" "}
            <strong>Spot shock</strong>, <strong>IV shock</strong>. Preset
            buttons isolate one Greek at a time (e.g. &quot;IV crush −5
            pts&quot; zeros out the others). Switching strategy auto-resets
            shocks.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              6. Read the P&amp;L Decomposition.
            </strong>{" "}
            Each Greek&apos;s dollar contribution + the formula that produced
            it. When the <strong>residual</strong> exceeds ~10% of actual
            P&amp;L, an amber warning appears — first-order Greeks no longer
            tell the whole story (big moves break the approximation).
          </li>
        </ol>

        <p className="mt-6 text-xs italic text-slate-500">
          Educational tool only. Not trading advice.
        </p>
      </DialogContent>
    </Dialog>
  );
}
