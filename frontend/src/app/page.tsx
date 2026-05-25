/**
 * Home page — composes the four working surfaces:
 *   Strategy Builder | Live Greeks
 *   Payoff Chart
 *   Time Machine
 *
 * Greek definitions, "Why use this", and "User guide" each live in modal
 * dialogs triggered from the header.
 *
 * State is in the Zustand store at `src/lib/store.ts`.
 */
import { Sigma } from "lucide-react";
import { StrategyBuilder } from "@/components/strategy-builder";
import { GreeksPanel } from "@/components/greeks-panel";
import { PayoffChart } from "@/components/payoff-chart";
import { TimeMachine } from "@/components/time-machine";
import { GreeksAtScenario } from "@/components/greeks-at-scenario";
import { GuideDialog } from "@/components/guide-dialog";
import { WhyUseThisDialog } from "@/components/why-use-this-dialog";
import { GreekDefinitionsDialog } from "@/components/greek-definitions-dialog";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1382px] px-6 py-10">
      {/* Header — title + descriptive subtitle on the left, three horizontal
          outline buttons on the right (aligned to the bottom of the title block). */}
      <header className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-6">
        <div className="lg:col-span-3">
          <h1 className="flex items-center gap-3 text-[28px] font-semibold tracking-tight text-red-900 sm:text-[34px] dark:text-red-400">
            <Sigma className="h-7 w-7 shrink-0 sm:h-9 sm:w-9" />
            Options Greeks Playground
          </h1>

          <p className="mt-4 max-w-prose text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100">
            Every options trade tells a story. This tool lets you read it.
          </p>
        </div>

        {/* Two-row stack on the right:
              Row 1: Why use this — full-width, filled maroon (primary CTA)
              Row 2: the two secondary buttons side-by-side, splitting Row 1's width */}
        <div className="flex flex-col gap-2 self-end lg:col-span-2">
          <WhyUseThisDialog />
          <div className="grid grid-cols-2 gap-2">
            <GreekDefinitionsDialog />
            <GuideDialog />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <StrategyBuilder />
        </div>
        <div className="lg:col-span-2">
          <GreeksPanel />
        </div>
      </div>

      <div className="mt-6">
        <PayoffChart />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TimeMachine />
        </div>
        <div className="lg:col-span-2">
          <GreeksAtScenario />
        </div>
      </div>

      <footer className="mt-12">
        <p className="text-xs text-slate-500">
          Educational tool only. Not trading advice.
        </p>
        <hr className="my-4 border-slate-200 dark:border-slate-800" />
        <p className="text-center text-xs text-slate-500">
          Created by — Sumbul Amin, Claude
        </p>
      </footer>
    </main>
  );
}
