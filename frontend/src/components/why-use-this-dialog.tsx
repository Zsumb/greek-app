"use client";

import { Lightbulb } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** "Why use this" button in the header → opens a modal explaining the value to traders. */
export function WhyUseThisDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="w-full" />}>
        <Lightbulb className="mr-2 h-4 w-4" />
        Why use this
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Why use this tool</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <section>
            <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              What this tool gives you
            </h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>P&amp;L Decomposition.</strong> For any scenario, break
                P&amp;L into Δ / Γ / Θ / Vega contributions in dollars — the
                differentiator. Most free tools skip this; it&apos;s how Greeks
                turn into intuition.
              </li>
              <li>
                <strong>Time-machine simulation.</strong> Move time forward,
                shock the underlying, jolt IV — see how <em>your</em> multi-leg
                position responds. Preset scenarios isolate one Greek at a time.
              </li>
              <li>
                <strong>Live market data.</strong> Type a US ticker → backend
                pulls real spot, expiries, ATM IV. Strikes auto-snap to ATM.
              </li>
              <li>
                <strong>Strategy presets.</strong> Long call, iron condor,
                vertical spread, straddle, covered call — pre-built and
                instantly editable.
              </li>
              <li>
                <strong>Educational framing.</strong> Every number comes with a
                one-line interpretation. The &quot;Change&quot; column tells you
                what a +5 delta shift means for your next $1 move.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              Insights you&apos;ll actually act on
            </h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <em>
                  &quot;Is collecting $50/day theta worth fighting gamma at this
                  strike?&quot;
                </em>{" "}
                — see the trade-off in dollars.
              </li>
              <li>
                <em>
                  &quot;My iron condor is killed by a 5% move, not by IV
                  expansion.&quot;
                </em>{" "}
                — stress-test before risking capital.
              </li>
              <li>
                <em>
                  &quot;This 30-delta call needs SPY to move $X just to break
                  even in 5 days.&quot;
                </em>{" "}
                — quantify the bar.
              </li>
              <li>
                <em>
                  &quot;Earnings IV crush would cost $300 on this
                  straddle.&quot;
                </em>{" "}
                — plan around events.
              </li>
              <li>
                <em>
                  &quot;Gamma will explode the week of expiry — exit by
                  Friday.&quot;
                </em>{" "}
                — anticipate exposure shifts.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              What changes in your trading
            </h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Compare two candidate trades by <strong>P&amp;L profile</strong>
                , not vibes.
              </li>
              <li>
                Decide to roll / close / hold by{" "}
                <strong>simulating each path</strong> forward.
              </li>
              <li>
                Size positions by <strong>real max loss</strong>, not premium
                paid.
              </li>
              <li>
                Avoid &quot;death by theta&quot; — see your daily bleed{" "}
                <em>before</em> you put the trade on.
              </li>
            </ul>
          </section>
        </div>

        <p className="mt-6 text-xs italic text-slate-500">
          Educational tool only. Not trading advice.
        </p>
      </DialogContent>
    </Dialog>
  );
}
