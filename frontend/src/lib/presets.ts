/**
 * Strategy presets. Each preset returns leg configurations parameterized by
 * the current underlying spot (so strikes land near ATM).
 */
import type { Position } from "./api";

type LegInput = Position["legs"][number];

export type PresetKey =
  | "long_call"
  | "long_put"
  | "long_straddle"
  | "bull_call_spread"
  | "iron_condor"
  | "custom";

export const PRESET_LABELS: Record<PresetKey, string> = {
  long_call: "Long Call",
  long_put: "Long Put",
  long_straddle: "Long Straddle",
  bull_call_spread: "Bull Call Spread",
  iron_condor: "Iron Condor",
  custom: "Custom",
};

/** Round to the nearest $5 strike (typical for liquid US equities). */
const atmStrike = (S: number) => Math.round(S / 5) * 5;

const DEFAULT_EXPIRY = 30;

export function presetLegs(preset: PresetKey, S: number): LegInput[] {
  const atm = atmStrike(S);
  const d = DEFAULT_EXPIRY;

  switch (preset) {
    case "long_call":
      return [{ kind: "call", strike: atm, expiry_days: d, quantity: 1 }];

    case "long_put":
      return [{ kind: "put", strike: atm, expiry_days: d, quantity: 1 }];

    case "long_straddle":
      return [
        { kind: "call", strike: atm, expiry_days: d, quantity: 1 },
        { kind: "put", strike: atm, expiry_days: d, quantity: 1 },
      ];

    case "bull_call_spread":
      // Long lower-strike call, short higher-strike call
      return [
        { kind: "call", strike: atm, expiry_days: d, quantity: 1 },
        { kind: "call", strike: atm + 10, expiry_days: d, quantity: -1 },
      ];

    case "iron_condor":
      // Short inner strikes (collect premium), long outer wings (cap risk)
      return [
        { kind: "put", strike: atm - 20, expiry_days: d, quantity: 1 },
        { kind: "put", strike: atm - 10, expiry_days: d, quantity: -1 },
        { kind: "call", strike: atm + 10, expiry_days: d, quantity: -1 },
        { kind: "call", strike: atm + 20, expiry_days: d, quantity: 1 },
      ];

    case "custom":
      return [];
  }
}
