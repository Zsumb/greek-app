/**
 * Playground page — the working surfaces of the tool:
 *   Strategy Builder | Live Greeks + Payoff Summary
 *   Time Machine     | Greeks at scenario
 *
 * Greek definitions, "Why use this", and "User guide" live in modal
 * dialogs triggered from the sub-header.
 *
 * The global site header + chat widget live in `app/layout.tsx`.
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
import { AskAiButton } from "@/components/ask-ai-button";

export default function PlaygroundPage() {
  return (
    <main className="mx-auto w-full max-w-[1382px] px-6 py-10">
      <header className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-6">
        <div className="lg:col-span-3">
          <h1 className="flex items-center gap-3 text-[28px] font-semibold tracking-tight text-red-900 sm:text-[34px] dark:text-red-400">
            <Sigma className="h-7 w-7 shrink-0 sm:h-9 sm:w-9" />
            Playground
          </h1>
          <p className="mt-4 max-w-prose text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100">
            Every options trade tells a story. This tool lets you read it.
          </p>
        </div>

        <div className="flex flex-col gap-2 self-end lg:col-span-2">
          <WhyUseThisDialog />
          <div className="grid grid-cols-2 gap-2">
            <GreekDefinitionsDialog />
            <GuideDialog />
          </div>
          <AskAiButton />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <StrategyBuilder />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <GreeksPanel />
          <PayoffChart />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TimeMachine />
        </div>
        <div className="lg:col-span-2">
          <GreeksAtScenario />
        </div>
      </div>
    </main>
  );
}
