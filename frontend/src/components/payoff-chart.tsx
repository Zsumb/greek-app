"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import type { Data, Layout, Config, Shape } from "plotly.js";
import { TrendingUp, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { api } from "@/lib/api";
import { usePosition } from "@/lib/store";
import { summarizePayoff } from "@/lib/payoff-summary";

// Plotly is browser-only — disable SSR to avoid `self is not defined`.
// Lazy-loaded inside the dialog so initial page load doesn't pull the bundle.
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
  ),
});

const TODAY_COLOR = "#3b82f6"; // blue-500
const EXPIRY_COLOR = "#10b981"; // emerald-500
const BE_COLOR = "#a1a1aa"; // zinc-400

export function PayoffChart() {
  const [open, setOpen] = useState(false);

  const S = usePosition((s) => s.S);
  const sigma = usePosition((s) => s.sigma);
  const r = usePosition((s) => s.r);
  const legs = usePosition((s) => s.legs);
  const toApiPosition = usePosition((s) => s.toApiPosition);

  // Widen the sampled spot range for high-IV positions so breakevens don't
  // fall outside the ±10% default window (which happens on names like NVDA
  // where a 30d ATM straddle can have breakevens ±15-30% from spot).
  //
  // Buffer is max of:
  //   - 10% of S     (floor — matches the old default for low-IV names)
  //   - 2.5σ move    (2.5 × S × σ × √T where T uses the shortest leg expiry)
  //   - 1.3 × furthest strike distance from S (make sure all strikes render)
  // Stock legs have no expiry/strike — only option legs shape the range.
  const optionLegs = legs.filter((l) => l.kind !== "stock");
  const minExpiryDays = optionLegs.length > 0
    ? Math.min(...optionLegs.map((l) => l.expiry_days))
    : 30;
  const T = Math.max(minExpiryDays, 1) / 365;
  const oneSigmaMove = S * sigma * Math.sqrt(T);
  const furthestStrikeGap = optionLegs.length > 0
    ? Math.max(...optionLegs.map((l) => Math.abs(l.strike - S)))
    : 0;
  const buffer = Math.max(
    S * 0.10,
    2.5 * oneSigmaMove,
    furthestStrikeGap * 1.3,
  );
  const spotMin = Math.max(0.01, S - buffer);
  const spotMax = S + buffer;

  const queryKey = [
    "payoff",
    S,
    sigma,
    r,
    JSON.stringify(legs.map(({ id: _id, ...rest }) => rest)),
    // spotMin/spotMax are derived from the above but include them explicitly
    // so any future decoupling still invalidates the query correctly.
    spotMin.toFixed(2),
    spotMax.toFixed(2),
  ];

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () =>
      api.positionPayoff({
        position: toApiPosition(),
        spot_min: spotMin,
        spot_max: spotMax,
        num_points: 201,
      }),
    enabled: legs.length > 0,
    retry: 0,
    staleTime: 0,
  });

  const summary = data ? summarizePayoff(data) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-900" />
              Payoff Summary
            </span>
            {isLoading && (
              <Badge variant="secondary" className="font-normal">
                loading…
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {legs.length === 0 && (
            <p className="text-sm text-zinc-500">
              Add a leg to see the payoff summary.
            </p>
          )}

          {isError && legs.length > 0 && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <p className="font-medium">Couldn&apos;t build the payoff curve.</p>
              <p className="mt-1 break-words font-mono text-xs">
                {(error as Error).message}
              </p>
            </div>
          )}

          {summary && (
            <>
              <TradeSummaryGrid summary={summary} compact />
              <Button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View full chart
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Full chart dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-red-900" />
            Payoff &amp; Trade Summary
          </DialogTitle>
          <DialogDescription>
            Full P&amp;L curve at expiration and today, with breakevens.
          </DialogDescription>

          {data && summary && (
            <div className="mt-4 space-y-4">
              <TradeSummaryGrid summary={summary} compact={false} />
              <PayoffChartBody data={data} spot={S} />
              <p className="text-xs text-zinc-500">
                Solid green = P&amp;L at expiration. Dotted blue = current P&amp;L
                (with remaining time value). Dashed vertical = current spot.
                Dotted verticals = breakeven(s).
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================

function PayoffChartBody({
  data,
  spot,
}: {
  data: NonNullable<
    ReturnType<typeof api.positionPayoff> extends Promise<infer T> ? T : never
  >;
  spot: number;
}) {
  const summary = summarizePayoff(data);

  const spots = data.points.map((p) => p.spot);
  const pnlToday = data.points.map((p) => p.pnl_today);
  const pnlExpiry = data.points.map((p) => p.pnl_at_expiry);

  const traces: Data[] = [
    {
      x: spots,
      y: pnlExpiry,
      name: "P&L at expiry",
      mode: "lines",
      line: { color: EXPIRY_COLOR, width: 2 },
      hovertemplate: "Spot $%{x:.2f}<br>P&L $%{y:.2f}<extra>Expiry</extra>",
    },
    {
      x: spots,
      y: pnlToday,
      name: "P&L today",
      mode: "lines",
      line: { color: TODAY_COLOR, width: 2, dash: "dot" },
      hovertemplate: "Spot $%{x:.2f}<br>P&L $%{y:.2f}<extra>Today</extra>",
    },
  ];

  const verticals: Partial<Shape>[] = [
    {
      type: "line",
      x0: spot,
      x1: spot,
      yref: "paper",
      y0: 0,
      y1: 1,
      line: { color: "#71717a", width: 1, dash: "dash" },
    },
    ...summary.breakevens.map((be) => ({
      type: "line" as const,
      x0: be,
      x1: be,
      yref: "paper" as const,
      y0: 0,
      y1: 1,
      line: { color: BE_COLOR, width: 1, dash: "dot" as const },
    })),
  ];

  const layout: Partial<Layout> = {
    autosize: true,
    height: 420,
    margin: { l: 60, r: 20, t: 10, b: 50 },
    xaxis: { title: { text: "Spot price ($)" }, gridcolor: "#e4e4e7" },
    yaxis: {
      title: { text: "P&L ($)" },
      gridcolor: "#e4e4e7",
      zeroline: true,
      zerolinecolor: "#a1a1aa",
      zerolinewidth: 1,
    },
    plot_bgcolor: "transparent",
    paper_bgcolor: "transparent",
    showlegend: true,
    legend: { x: 0.02, y: 0.98, bgcolor: "rgba(255,255,255,0.7)" },
    shapes: verticals,
    hovermode: "x unified",
  };

  const config: Partial<Config> = {
    displayModeBar: false,
    responsive: true,
  };

  return (
    <Plot
      data={traces}
      layout={layout}
      config={config}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}

// ============================================================================

function TradeSummaryGrid({
  summary,
  compact,
}: {
  summary: ReturnType<typeof summarizePayoff>;
  compact: boolean;
}) {
  const debit = summary.netDebit;
  const isCredit = debit < 0;

  const gridClass = compact
    ? "grid grid-cols-2 gap-3"
    : "grid grid-cols-2 gap-4 sm:grid-cols-4";

  return (
    <dl className={gridClass}>
      <Metric
        label={isCredit ? "Net credit" : "Net debit"}
        value={`$${Math.abs(debit).toFixed(2)}`}
        tone={isCredit ? "pos" : "neg"}
        compact={compact}
      />
      <Metric
        label="Max profit"
        value={
          summary.maxProfitUnbounded
            ? "Unlimited"
            : `$${summary.maxProfit.toFixed(2)}`
        }
        tone="pos"
        compact={compact}
      />
      <Metric
        label="Max loss"
        value={
          summary.maxLossUnbounded
            ? "Unlimited"
            : `$${summary.maxLoss.toFixed(2)}`
        }
        tone="neg"
        compact={compact}
      />
      <Metric
        label="Breakeven(s)"
        value={
          summary.breakevens.length === 0
            ? "—"
            : summary.breakevens.map((b) => `$${b.toFixed(2)}`).join(", ")
        }
        compact={compact}
      />
    </dl>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "pos" | "neg";
  compact?: boolean;
}) {
  const toneClass =
    tone === "pos"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "neg"
      ? "text-red-700 dark:text-red-400"
      : "text-zinc-900 dark:text-zinc-100";
  // In the compact 2×2 grid the "Breakeven(s)" cell has to hold two values
  // like "$477.12, $522.88" in a narrow column — drop to text-sm so it fits
  // on one line and stays clearly comma-separated. Also allow wrap as a
  // graceful fallback on very narrow viewports.
  const sizeClass = compact ? "text-sm" : "text-base";
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd
        className={`break-words font-mono ${sizeClass} ${toneClass}`}
      >
        {value}
      </dd>
    </div>
  );
}
