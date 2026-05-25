"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomScenarioDialog } from "@/components/custom-scenario-dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

import { api } from "@/lib/api";
import { usePosition } from "@/lib/store";
import { DecompositionBar, type DecompRow } from "@/components/decomposition-bar";

/**
 * Time Machine — the differentiator.
 * Three sliders (days, dS, dSigma) + preset scenarios + P&L decomposition.
 * Hits POST /position/simulate on every change.
 */
export function TimeMachine() {
  const S = usePosition((s) => s.S);
  const sigma = usePosition((s) => s.sigma);
  const r = usePosition((s) => s.r);
  const legs = usePosition((s) => s.legs);
  const toApiPosition = usePosition((s) => s.toApiPosition);

  // Scenario shocks live in the store so that switching strategy preset
  // (or ticker) auto-clears them. Local helpers keep the JSX terse.
  const dS = usePosition((s) => s.dS);
  const dSigma = usePosition((s) => s.dSigma);
  const dDays = usePosition((s) => s.dDays);
  const setShocks = usePosition((s) => s.setShocks);
  const resetShocks = usePosition((s) => s.resetShocks);
  const setDS = (v: number) => setShocks({ dS: v });
  const setDSigma = (v: number) => setShocks({ dSigma: v });
  const setDDays = (v: number) => setShocks({ dDays: v });

  // Slider bounds, derived from the current position
  const dSMax = Math.max(5, Math.round(S * 0.2)); // ±20% of spot, min ±$5
  const sigmaMin = Math.max(0.05, sigma); // don't let user push IV below 5%
  const dSigmaMin = -(sigmaMin - 0.01); // floor 1% IV
  const dSigmaMax = 0.3;
  const minExpiry = legs.length > 0 ? Math.min(...legs.map((l) => l.expiry_days)) : 30;
  const dDaysMax = Math.max(1, minExpiry - 1); // can't simulate past expiry

  // Each preset's `target` is the (dS, dSigma, dDays) tuple it would apply.
  // Exposed so we can highlight the preset whose target matches the current
  // sliders — gives users a visual "you're currently on this scenario" cue.
  const presets = [
    { label: "Tomorrow flat", target: { dS: 0, dSigma: 0, dDays: 1 } },
    { label: "Tomorrow +2%", target: { dS: S * 0.02, dSigma: 0, dDays: 1 } },
    { label: "IV crush −5 pts", target: { dS: 0, dSigma: -0.05, dDays: 0 } },
    {
      label: "Halfway to expiry, flat",
      target: {
        dS: 0,
        dSigma: 0,
        dDays: Math.max(1, Math.floor(minExpiry / 2)),
      },
    },
  ];

  /** True when the current shocks match this preset's target (within float tolerance). */
  const isPresetActive = (t: { dS: number; dSigma: number; dDays: number }) =>
    Math.abs(t.dS - dS) < 0.01 &&
    Math.abs(t.dSigma - dSigma) < 1e-4 &&
    t.dDays === dDays;

  function apply(s: number, sig: number, days: number) {
    setShocks({
      dS: clamp(s, -dSMax, dSMax),
      dSigma: clamp(sig, dSigmaMin, dSigmaMax),
      dDays: clamp(days, 0, dDaysMax),
    });
  }

  // API query — re-runs on any shock change
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
            <Clock className="h-5 w-5 text-red-900" />
            Time Machine
          </span>
          {isLoading && (
            <Badge variant="secondary" className="font-normal">
              loading…
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {legs.length === 0 && (
          <p className="text-sm text-zinc-500">
            Build a position above to simulate scenarios.
          </p>
        )}

        {legs.length > 0 && (
          <>
            {/* Preset scenarios — active preset uses the theme primary color.
                Trailing "Custom scenario" button highlights when shocks are
                non-zero and don't match any named preset. */}
            {(() => {
              const anyPresetActive = presets.some((p) =>
                isPresetActive(p.target),
              );
              const customActive =
                !anyPresetActive && (dS !== 0 || dSigma !== 0 || dDays !== 0);
              return (
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => {
                    const active = isPresetActive(p.target);
                    return (
                      <Button
                        key={p.label}
                        type="button"
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          apply(p.target.dS, p.target.dSigma, p.target.dDays)
                        }
                      >
                        {p.label}
                      </Button>
                    );
                  })}
                  <CustomScenarioDialog
                    active={customActive}
                    bounds={{
                      dSMin: -dSMax,
                      dSMax,
                      dSigmaMin,
                      dSigmaMax,
                      dDaysMin: 0,
                      dDaysMax,
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetShocks}
                    className="ml-auto"
                  >
                    Reset
                  </Button>
                </div>
              );
            })()}

            {/* Sliders */}
            <div className="space-y-5">
              <SliderRow
                label="Days forward"
                value={dDays}
                onChange={setDDays}
                min={0}
                max={dDaysMax}
                step={1}
                format={(v) =>
                  v === 0 ? "today" : `+${v} day${v === 1 ? "" : "s"}`
                }
              />
              <SliderRow
                label="Spot shock"
                value={dS}
                onChange={setDS}
                min={-dSMax}
                max={dSMax}
                step={0.5}
                format={(v) =>
                  `${v >= 0 ? "+" : ""}$${v.toFixed(2)} (${
                    v >= 0 ? "+" : ""
                  }${((v / S) * 100).toFixed(1)}%)`
                }
              />
              <SliderRow
                label="IV shock"
                value={dSigma}
                onChange={setDSigma}
                min={dSigmaMin}
                max={dSigmaMax}
                step={0.005}
                format={(v) =>
                  `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} vol-pt${
                    Math.abs(v * 100) === 1 ? "" : "s"
                  }`
                }
              />
            </div>

            {isError && (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                <p className="font-medium">Simulation failed.</p>
                <p className="mt-1 break-words font-mono text-xs">
                  {(error as Error).message}
                </p>
              </div>
            )}

            {data && (
              <SimulationResult
                data={data}
                shocks={{ dS, dSigma, dDays }}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr_140px] items-center gap-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
      <div className="text-right font-mono text-sm">{format(value)}</div>
    </div>
  );
}

type Shocks = { dS: number; dSigma: number; dDays: number };

function SimulationResult({
  data,
  shocks,
}: {
  data: Awaited<ReturnType<typeof api.positionSimulate>>;
  shocks: Shocks;
}) {
  const { dS, dSigma, dDays } = shocks;
  const init = data.initial_greeks;
  const dSigmaPts = dSigma * 100; // decimal IV change → vol-points

  const rows: DecompRow[] = [
    {
      label: "Δ contribution",
      value: data.delta_contribution,
      calc: `Δ × dS = ${init.delta.toFixed(2)} × ${fmtDollar(dS)}`,
    },
    {
      label: "Γ contribution",
      value: data.gamma_contribution,
      calc: `½ × Γ × dS² = ½ × ${init.gamma.toFixed(4)} × ${fmtDollar(dS)}²`,
    },
    {
      label: "Θ contribution",
      value: data.theta_contribution,
      calc: `Θ × dDays = ${fmtDollar(init.theta_per_day)} × ${dDays}`,
    },
    {
      label: "Vega contribution",
      value: data.vega_contribution,
      calc: `Vega × dIV(vol-pts) = ${fmtDollar(init.vega_per_volpoint)} × ${dSigmaPts.toFixed(1)}`,
    },
    {
      label: "Sum",
      value: data.sum_of_components,
      emphasis: true,
      calc: `Δ + Γ + Θ + Vega contributions`,
    },
    {
      label: "Residual",
      value: data.residual,
      calc: `Actual − Sum = ${fmtDollar(data.actual_pnl)} − ${fmtDollar(data.sum_of_components)}`,
    },
    {
      // Actual P&L — calc omitted intentionally (it's a full Black-Scholes
      // repricing, not an additive formula).
      label: "Actual P&L",
      value: data.actual_pnl,
      emphasis: true,
    },
  ];

  const residualPct =
    data.actual_pnl !== 0
      ? Math.abs((data.residual / data.actual_pnl) * 100)
      : 0;
  const approximationDegrading = residualPct > 10 && Math.abs(data.actual_pnl) > 10;

  const story = buildStory(data);

  return (
    <div className="space-y-6">
      {/* Headline P&L */}
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Scenario P&L
          </div>
          <div
            className={`font-mono text-3xl ${
              data.actual_pnl >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {data.actual_pnl >= 0 ? "+" : ""}${data.actual_pnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Decomposition */}
      <div>
        <h3 className="mb-3 text-sm font-medium">P&L Decomposition</h3>
        <DecompositionBar rows={rows} emphasizedAt={4} />
      </div>

      {/* Plain-English story */}
      {story && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">
          {story}
        </div>
      )}

      {approximationDegrading && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Heads up:</strong> the residual is {residualPct.toFixed(0)}%
          of your actual P&amp;L. First-order Greeks are losing accuracy at
          this shock size — try a smaller move to keep the story clean.
        </div>
      )}
    </div>
  );
}

/** Build a plain-English sentence describing the dominant Greek contributions. */
function buildStory(
  data: Awaited<ReturnType<typeof api.positionSimulate>>,
): string | null {
  const parts: string[] = [];
  const contributors: [string, number][] = [
    ["delta", data.delta_contribution],
    ["gamma", data.gamma_contribution],
    ["theta", data.theta_contribution],
    ["vega", data.vega_contribution],
  ];
  // Skip tiny contributions
  const significant = contributors.filter(([_, v]) => Math.abs(v) >= 1);
  if (significant.length === 0) return null;

  // Sort by absolute magnitude (biggest mover first)
  significant.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  for (const [name, v] of significant) {
    const sign = v >= 0 ? "added" : "cost you";
    parts.push(`${name.charAt(0).toUpperCase() + name.slice(1)} ${sign} $${Math.abs(v).toFixed(2)}`);
  }
  return parts.join("; ") + ".";
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Format a dollar amount with hyphen-minus sign for negatives, no leading "+". */
function fmtDollar(n: number, decimals = 2): string {
  if (n === 0) return "$0";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(decimals)}`;
}
