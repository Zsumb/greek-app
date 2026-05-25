/**
 * Zustand store for the working position.
 * The strategy builder writes here; the Greeks panel and (later) the
 * time-machine simulator read from here.
 */
import { create } from "zustand";
import type { ExpiryItem, Position, TickerSnapshot } from "./api";
import { presetLegs, type PresetKey } from "./presets";

export type LegInput = Position["legs"][number];
export type Leg = LegInput & { id: string };

let _legId = 0;
const nextId = () => `leg-${++_legId}`;

type PositionStore = {
  // Underlying inputs
  S: number;
  sigma: number; // decimal (0.20 = 20%)
  r: number; // decimal (0.05 = 5%)

  // Legs
  legs: Leg[];
  preset: PresetKey;

  // Ticker / market context (populated when a snapshot is fetched)
  ticker: string | null;
  availableExpiries: ExpiryItem[]; // empty => no ticker loaded

  // Time-machine scenario shocks. Kept in the store (not local component
  // state) so applyPreset / applyTickerSnapshot can zero them atomically —
  // otherwise old shocks linger after the user switches strategies and the
  // simulator silently keeps applying the previous what-if.
  dS: number; // dollars
  dSigma: number; // decimal IV change
  dDays: number; // calendar days forward

  // Actions
  setS: (S: number) => void;
  setSigma: (sigma: number) => void;
  setR: (r: number) => void;

  applyPreset: (preset: PresetKey) => void;
  addLeg: () => void;
  updateLeg: (id: string, patch: Partial<LegInput>) => void;
  removeLeg: (id: string) => void;

  applyTickerSnapshot: (snap: TickerSnapshot) => void;

  setShocks: (
    patch: Partial<{ dS: number; dSigma: number; dDays: number }>,
  ) => void;
  resetShocks: () => void;

  /** Build the API payload (strip internal `id` from legs). */
  toApiPosition: () => Position;
};

const ZERO_SHOCKS = { dS: 0, dSigma: 0, dDays: 0 };

const INITIAL_S = 500;

export const usePosition = create<PositionStore>((set, get) => ({
  S: INITIAL_S,
  sigma: 0.2,
  r: 0.05,

  legs: presetLegs("long_call", INITIAL_S).map((l) => ({ ...l, id: nextId() })),
  preset: "long_call",

  ticker: null,
  availableExpiries: [],

  ...ZERO_SHOCKS,

  setS: (S) => set({ S }),
  setSigma: (sigma) => set({ sigma }),
  setR: (r) => set({ r }),

  setShocks: (patch) => set((s) => ({ ...s, ...patch })),
  resetShocks: () => set(ZERO_SHOCKS),

  applyPreset: (preset) =>
    set((s) => ({
      preset,
      legs: presetLegs(preset, s.S).map((l) => ({ ...l, id: nextId() })),
      // Switching strategies invalidates any in-flight scenario — reset
      // so the time-machine doesn't apply the previous what-if to the new
      // position.
      ...ZERO_SHOCKS,
    })),

  addLeg: () =>
    set((s) => ({
      preset: "custom",
      legs: [
        ...s.legs,
        { id: nextId(), kind: "call", strike: s.S, expiry_days: 30, quantity: 1 },
      ],
    })),

  updateLeg: (id, patch) =>
    set((s) => ({
      preset: "custom",
      legs: s.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    })),

  removeLeg: (id) =>
    set((s) => ({
      preset: "custom",
      legs: s.legs.filter((l) => l.id !== id),
    })),

  applyTickerSnapshot: (snap) =>
    set((s) => {
      const nextS = snap.spot;
      const nextSigma = snap.atm_iv ?? s.sigma;
      const expiries = snap.expiries;

      // Snap each existing leg's expiry to the nearest available DTE so the
      // builder lines up with real expiry dates, but preserve the user's intent.
      const dteList = expiries.map((e) => e.days_to_expiry);
      const snapDTE = (d: number) =>
        dteList.length === 0
          ? d
          : dteList.reduce((a, b) =>
              Math.abs(b - d) < Math.abs(a - d) ? b : a,
            );

      // If a non-custom preset is active, rebuild legs around the new spot
      // (so strikes track ATM); otherwise leave the user's legs intact.
      const baseLegs =
        s.preset === "custom"
          ? s.legs
          : presetLegs(s.preset, nextS).map((l) => ({ ...l, id: nextId() }));

      const newLegs = baseLegs.map((l) => ({
        ...l,
        expiry_days: snapDTE(l.expiry_days),
      }));

      return {
        S: nextS,
        sigma: nextSigma,
        ticker: snap.ticker,
        availableExpiries: expiries,
        legs: newLegs,
        // New ticker = new context → drop any active scenario shocks.
        ...ZERO_SHOCKS,
      };
    }),

  toApiPosition: () => {
    const s = get();
    return {
      S: s.S,
      sigma: s.sigma,
      r: s.r,
      legs: s.legs.map(({ id: _id, ...rest }) => rest),
    };
  },
}));
