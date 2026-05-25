"use client";

import { Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LegEditor } from "@/components/leg-editor";
import { TickerInput } from "@/components/ticker-input";
import { api } from "@/lib/api";
import { usePosition } from "@/lib/store";
import { PRESET_LABELS, type PresetKey } from "@/lib/presets";

export function StrategyBuilder() {
  const S = usePosition((s) => s.S);
  const sigma = usePosition((s) => s.sigma);
  const r = usePosition((s) => s.r);
  const setS = usePosition((s) => s.setS);
  const setSigma = usePosition((s) => s.setSigma);
  const setR = usePosition((s) => s.setR);

  const preset = usePosition((s) => s.preset);
  const applyPreset = usePosition((s) => s.applyPreset);

  const legs = usePosition((s) => s.legs);
  const addLeg = usePosition((s) => s.addLeg);
  const toApiPosition = usePosition((s) => s.toApiPosition);

  // Per-leg premiums — fetched alongside Greeks so each LegEditor can show
  // its own option price next to qty. Same queryKey shape as Greeks panel.
  const legPricesQuery = useQuery({
    queryKey: [
      "leg-prices",
      S,
      sigma,
      r,
      JSON.stringify(legs.map(({ id: _id, ...rest }) => rest)),
    ],
    queryFn: () => api.positionLegPrices(toApiPosition()),
    enabled: legs.length > 0,
    retry: 0,
    staleTime: 0,
  });
  const prices = legPricesQuery.data?.prices ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-red-900" />
          Strategy Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ticker lookup */}
        <TickerInput />

        <Separator />

        {/* Underlying parameters */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="Spot ($)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={S}
              onChange={(e) => setS(Number(e.target.value))}
            />
          </Field>
          <Field label="IV (%)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={(sigma * 100).toFixed(2)}
              onChange={(e) => setSigma(Number(e.target.value) / 100)}
            />
          </Field>
          <Field label="Rate (%)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.25"
              value={(r * 100).toFixed(2)}
              onChange={(e) => setR(Number(e.target.value) / 100)}
            />
          </Field>
        </div>

        <Separator />

        {/* Preset */}
        <Field label="Preset">
          <Select
            value={preset}
            onValueChange={(v) => applyPreset(v as PresetKey)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESET_LABELS) as PresetKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {PRESET_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Legs */}
        <div className="space-y-3">
          {/* Add-leg icon button right-aligns to the container edge, which is
              the same right edge the trash buttons sit at in each leg row
              below — so they line up vertically. */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Legs{" "}
              <span className="text-zinc-500 font-normal">
                ({legs.length})
              </span>
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLeg}
            >
              Add leg
            </Button>
          </div>

          {legs.length === 0 ? (
            <p className="rounded border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No legs yet. Pick a preset or click <strong>Add leg</strong>.
            </p>
          ) : (
            <div className="space-y-3">
              {legs.map((leg, i) => (
                <LegEditor key={leg.id} leg={leg} pricePerShare={prices[i]} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}
