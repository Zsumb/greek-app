"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sigma } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { api } from "@/lib/api";
import { usePosition } from "@/lib/store";

/**
 * Side panel that lives next to the Time Machine: shows each Greek's
 * initial vs. post-scenario value plus a plain-English interpretation of
 * the change.
 *
 * Runs its own /position/simulate query, but TanStack Query dedupes by
 * the shared queryKey — so this and TimeMachine share a single backend
 * round-trip per scenario.
 */
export function GreeksAtScenario() {
  const S = usePosition((s) => s.S);
  const sigma = usePosition((s) => s.sigma);
  const r = usePosition((s) => s.r);
  const legs = usePosition((s) => s.legs);
  const dS = usePosition((s) => s.dS);
  const dSigma = usePosition((s) => s.dSigma);
  const dDays = usePosition((s) => s.dDays);
  const toApiPosition = usePosition((s) => s.toApiPosition);

  const queryKey = useMemo(
    () => [
      "simulate",
      S,
      sigma,
      r,
      JSON.stringify(legs.map(({ id: _id, ...rest }) => rest)),
      dS,
      dSigma,
      dDays,
    ],
    [S, sigma, r, legs, dS, dSigma, dDays],
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () =>
      api.positionSimulate({
        position: toApiPosition(),
        dS,
        dSigma,
        dDays,
      }),
    enabled: legs.length > 0,
    retry: 0,
    staleTime: 0,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sigma className="h-5 w-5 text-red-900" />
            Greeks at scenario
          </span>
          {isLoading && (
            <Badge variant="secondary" className="font-normal">
              loading…
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {legs.length === 0 && (
          <p className="text-sm text-zinc-500">
            Build a position to see scenario Greeks.
          </p>
        )}

        {isError && legs.length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-medium">Couldn&apos;t fetch scenario Greeks.</p>
            <p className="mt-1 break-words font-mono text-xs">
              {(error as Error).message}
            </p>
          </div>
        )}

        {data && (
          <div className="overflow-hidden rounded border border-zinc-200 text-sm dark:border-zinc-800">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-zinc-500">
                    Greek
                  </th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-zinc-500">
                    Initial
                  </th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-zinc-500">
                    After
                  </th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-zinc-500">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <GreekRow
                  label="Delta"
                  init={data.initial_greeks.delta}
                  next={data.new_greeks.delta}
                  fmt={(v) => v.toFixed(2)}
                  kind="delta"
                />
                <GreekRow
                  label="Gamma"
                  init={data.initial_greeks.gamma}
                  next={data.new_greeks.gamma}
                  fmt={(v) => v.toFixed(4)}
                  kind="gamma"
                />
                <GreekRow
                  label="Theta / day"
                  init={data.initial_greeks.theta_per_day}
                  next={data.new_greeks.theta_per_day}
                  fmt={(v) => `$${v.toFixed(2)}`}
                  kind="theta"
                />
                <GreekRow
                  label="Vega / vol-pt"
                  init={data.initial_greeks.vega_per_volpoint}
                  next={data.new_greeks.vega_per_volpoint}
                  fmt={(v) => `$${v.toFixed(2)}`}
                  kind="vega"
                />
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type GreekKind = "delta" | "gamma" | "theta" | "vega";

/** Below these thresholds, the change is too small to matter at display precision. */
const TINY_CHANGE: Record<GreekKind, number> = {
  delta: 0.005,
  gamma: 0.0005,
  theta: 0.005,
  vega: 0.005,
};

function GreekRow({
  label,
  init,
  next,
  fmt,
  kind,
}: {
  label: string;
  init: number;
  next: number;
  fmt: (v: number) => string;
  kind: GreekKind;
}) {
  const change = next - init;
  const tiny = Math.abs(change) < TINY_CHANGE[kind];
  const arrow = tiny ? "≈" : change > 0 ? "↑" : "↓";
  const explanation = explainGreekChange(kind, change);

  const changeToneClass = tiny
    ? "text-zinc-500"
    : change > 0
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-red-700 dark:text-red-400";

  return (
    <tr className="border-t border-zinc-200 dark:border-zinc-800">
      <td className="px-3 py-2 align-top font-sans text-zinc-700 dark:text-zinc-300">
        {label}
      </td>
      <td className="px-3 py-2 text-right align-top">{fmt(init)}</td>
      <td className="px-3 py-2 text-right align-top">{fmt(next)}</td>
      <td className="px-3 py-2 align-top text-right">
        <div className={`text-sm ${changeToneClass}`}>
          {tiny ? "≈ 0" : `${arrow} ${fmt(Math.abs(change))}`}
        </div>
        <div className="mt-1 text-left font-sans text-xs leading-snug text-zinc-500">
          {explanation}
        </div>
      </td>
    </tr>
  );
}

/**
 * Translate a change in a Greek into a plain-English sentence about what the
 * position will now do per unit move of the relevant driver (spot, time, IV).
 */
function explainGreekChange(kind: GreekKind, change: number): string {
  if (Math.abs(change) < TINY_CHANGE[kind]) {
    return {
      delta: "Spot sensitivity unchanged",
      gamma: "Convexity unchanged",
      theta: "Time sensitivity unchanged",
      vega: "IV sensitivity unchanged",
    }[kind];
  }

  const dir = change > 0 ? "more" : "less";
  const abs = Math.abs(change).toFixed(2);

  switch (kind) {
    case "delta":
      return `Each $1 spot move now changes P&L by $${abs} ${dir}`;
    case "gamma": {
      const reactivity = change > 0 ? "more reactive" : "less reactive";
      return `Each $1 spot move now adjusts delta by ${abs} ${dir} (position ${reactivity})`;
    }
    case "theta": {
      const decayHint = change > 0 ? "less decay" : "more decay";
      return `Each day forward now contributes $${abs} ${dir} to P&L (${decayHint})`;
    }
    case "vega":
      return `Each 1 vol-pt IV move now changes P&L by $${abs} ${dir}`;
  }
}
