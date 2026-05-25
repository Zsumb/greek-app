"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import type { Data, Layout, Config, Shape } from "plotly.js";
import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { api } from "@/lib/api";
import { usePosition } from "@/lib/store";
import { summarizePayoff } from "@/lib/payoff-summary";

// Plotly is browser-only — disable SSR to avoid `self is not defined`.
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
  ),
});

const TODAY_COLOR = "#3b82f6"; // blue-500
const EXPIRY_COLOR = "#10b981"; // emerald-500
const BE_COLOR = "#a1a1aa"; // zinc-400

export function PayoffChart() {
  const S = usePosition((s) => s.S);
  const sigma = usePosition((s) => s.sigma);
  const r = usePosition((s) => s.r);
  const legs = usePosition((s) => s.legs);
  const toApiPosition = usePosition((s) => s.toApiPosition);

  const queryKey = [
    "payoff",
    S,
    sigma,
    r,
    JSON.stringify(legs.map(({ id: _id, ...rest }) => rest)),
  ];

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () =>
      api.positionPayoff({ position: toApiPosition(), num_points: 201 }),
    enabled: legs.length > 0,
    retry: 0,
    staleTime: 0,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-red-900" />
            Payoff &amp; Trade Summary
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
            Add a leg to see the payoff diagram.
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

        {data && <PayoffBody data={data} spot={S} />}
      </CardContent>
    </Card>
  );
}

function PayoffBody({
  data,
  spot,
}: {
  data: NonNullable<ReturnType<typeof api.positionPayoff> extends Promise<infer T> ? T : never>;
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

  // Vertical reference lines: current spot + each breakeven
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
    height: 380,
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
    <div className="space-y-6">
      {/* Trade summary metrics strip */}
      <TradeSummaryStrip summary={summary} />

      {/* Chart */}
      <Plot
        data={traces}
        layout={layout}
        config={config}
        style={{ width: "100%" }}
        useResizeHandler
      />

      <p className="text-xs text-zinc-500">
        Solid green = P&amp;L at expiration. Dotted blue = current P&amp;L
        (with remaining time value). Dashed vertical = current spot. Dotted
        verticals = breakeven(s).
      </p>
    </div>
  );
}

function TradeSummaryStrip({ summary }: { summary: ReturnType<typeof summarizePayoff> }) {
  const debit = summary.netDebit;
  const isCredit = debit < 0;

  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Metric
        label={isCredit ? "Net credit" : "Net debit"}
        value={`$${Math.abs(debit).toFixed(2)}`}
        tone={isCredit ? "pos" : "neg"}
      />
      <Metric
        label="Max profit"
        value={
          summary.maxProfitUnbounded
            ? "Unlimited"
            : `$${summary.maxProfit.toFixed(2)}`
        }
        tone="pos"
      />
      <Metric
        label="Max loss"
        value={
          summary.maxLossUnbounded
            ? "Unlimited"
            : `$${summary.maxLoss.toFixed(2)}`
        }
        tone="neg"
      />
      <Metric
        label="Breakeven(s)"
        value={
          summary.breakevens.length === 0
            ? "—"
            : summary.breakevens.map((b) => `$${b.toFixed(2)}`).join(", ")
        }
      />
    </dl>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "pos" | "neg";
}) {
  const toneClass =
    tone === "pos"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "neg"
      ? "text-red-700 dark:text-red-400"
      : "text-zinc-900 dark:text-zinc-100";
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={`font-mono text-base ${toneClass}`}>{value}</dd>
    </div>
  );
}
