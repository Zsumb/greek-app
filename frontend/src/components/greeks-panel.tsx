"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { usePosition } from "@/lib/store";

/** Live Greeks panel — re-queries whenever the position changes. */
export function GreeksPanel() {
  const S = usePosition((s) => s.S);
  const sigma = usePosition((s) => s.sigma);
  const r = usePosition((s) => s.r);
  const legs = usePosition((s) => s.legs);
  const toApiPosition = usePosition((s) => s.toApiPosition);

  // Stable, JSON-serializable key so React Query refetches on any change.
  const queryKey = [
    "greeks",
    S,
    sigma,
    r,
    JSON.stringify(legs.map(({ id: _id, ...rest }) => rest)),
  ];

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => api.positionGreeks(toApiPosition()),
    enabled: legs.length > 0,
    retry: 0,
    staleTime: 0,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-red-900" />
            Live Greeks
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
            Add a leg to see Greeks.
          </p>
        )}

        {isError && legs.length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-medium">Couldn&apos;t compute Greeks.</p>
            <p className="mt-1 break-words font-mono text-xs">
              {(error as Error).message}
            </p>
          </div>
        )}

        {data && (
          <>
            <dl className="grid grid-cols-2 gap-y-4 gap-x-6 sm:grid-cols-3">
              <Stat
                label="Position value"
                value={`$${data.price.toFixed(2)}`}
                tone={data.price >= 0 ? "neutral" : "neg"}
              />
              <Stat
                label="Delta"
                value={data.delta.toFixed(2)}
                tone={signTone(data.delta)}
                hint="$ P&L per $1 move in underlying"
              />
              <Stat
                label="Gamma"
                value={data.gamma.toFixed(4)}
                tone={signTone(data.gamma)}
                hint="Δ change per $1 move"
              />
              <Stat
                label="Theta / day"
                value={`$${data.theta_per_day.toFixed(2)}`}
                tone={signTone(data.theta_per_day)}
                hint="$ change per day forward"
              />
              <Stat
                label="Vega / vol-pt"
                value={`$${data.vega_per_volpoint.toFixed(2)}`}
                tone={signTone(data.vega_per_volpoint)}
                hint="$ change per 1 vol point"
              />
              <Stat
                label="Rho / 1%"
                value={`$${data.rho_per_pct.toFixed(2)}`}
                tone={signTone(data.rho_per_pct)}
                hint="$ change per 1% rate move"
              />
            </dl>
            <p className="mt-6 text-xs text-zinc-500">
              Greeks computed live by the backend. Numbers scale with contract
              size (1 contract = 100 shares).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type Tone = "neutral" | "pos" | "neg";

function signTone(v: number): Tone {
  if (Math.abs(v) < 0.005) return "neutral";
  return v > 0 ? "pos" : "neg";
}

function Stat({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: Tone;
  hint?: string;
}) {
  const toneClass =
    tone === "pos"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "neg"
      ? "text-red-700 dark:text-red-400"
      : "text-zinc-900 dark:text-zinc-100";
  return (
    <div title={hint}>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={`font-mono text-lg ${toneClass}`}>{value}</dd>
    </div>
  );
}
