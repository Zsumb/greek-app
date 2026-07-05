/**
 * Zustand position-store unit tests.
 *
 * The store is a singleton — we reset it via `usePosition.setState(...)` at
 * the top of each test rather than re-importing. This mirrors how the live
 * app holds its state.
 */
import { beforeEach, describe, it, expect } from "vitest";

import { usePosition } from "./store";

// Capture the initial state once so we can re-seed before each test
const INITIAL = usePosition.getState();

beforeEach(() => {
  // Reset to a clean baseline (long_call default)
  usePosition.setState({
    S: 500,
    sigma: 0.2,
    r: 0.05,
    legs: INITIAL.legs.map((l) => ({ ...l })),
    preset: "long_call",
    ticker: null,
    availableExpiries: [],
    dS: 0,
    dSigma: 0,
    dDays: 0,
  });
});

// === I1 — applyPreset zeros shocks ===
describe("I1: applyPreset resets time-machine shocks", () => {
  it("clears dS/dSigma/dDays atomically when switching preset", () => {
    // Seed non-zero shocks
    usePosition.setState({ dS: 12.5, dSigma: -0.03, dDays: 4 });
    usePosition.getState().applyPreset("iron_condor");
    const s = usePosition.getState();
    expect(s.dS).toBe(0);
    expect(s.dSigma).toBe(0);
    expect(s.dDays).toBe(0);
    expect(s.preset).toBe("iron_condor");
    expect(s.legs.length).toBe(4); // iron condor has 4 legs
  });
});

// === I2 — applyTickerSnapshot zeros shocks ===
describe("I2: applyTickerSnapshot resets shocks", () => {
  it("clears shocks when a new ticker is fetched", () => {
    usePosition.setState({ dS: 8, dSigma: 0.02, dDays: 3 });
    usePosition.getState().applyTickerSnapshot({
      ticker: "AAPL",
      spot: 230,
      as_of: "2026-05-25T00:00:00Z",
      expiries: [
        { date: "2026-05-30", days_to_expiry: 5 },
        { date: "2026-06-20", days_to_expiry: 26 },
      ],
      atm_expiry: "2026-06-20",
      atm_strike: 230,
      atm_iv: 0.28,
    });
    const s = usePosition.getState();
    expect(s.dS).toBe(0);
    expect(s.dSigma).toBe(0);
    expect(s.dDays).toBe(0);
    expect(s.ticker).toBe("AAPL");
    expect(s.S).toBe(230);
    expect(s.sigma).toBe(0.28);
    expect(s.availableExpiries.length).toBe(2);
  });
});

// === I3-I5 — editing legs flips preset to "custom" ===
describe("I3-I5: leg edits set preset to 'custom'", () => {
  it("I3: updateLeg sets preset='custom'", () => {
    const id = usePosition.getState().legs[0].id;
    usePosition.getState().updateLeg(id, { strike: 510 });
    expect(usePosition.getState().preset).toBe("custom");
  });

  it("I4: addLeg sets preset='custom'", () => {
    usePosition.getState().addLeg();
    expect(usePosition.getState().preset).toBe("custom");
    expect(usePosition.getState().legs.length).toBe(2);
  });

  it("I5: removeLeg sets preset='custom'", () => {
    const id = usePosition.getState().legs[0].id;
    usePosition.getState().removeLeg(id);
    expect(usePosition.getState().preset).toBe("custom");
    expect(usePosition.getState().legs.length).toBe(0);
  });
});

// === I6 — toApiPosition strips internal IDs ===
describe("I6: toApiPosition strips internal ids", () => {
  it("returned legs have no `id` field", () => {
    const apiPos = usePosition.getState().toApiPosition();
    for (const leg of apiPos.legs) {
      // @ts-expect-error — legs in API output should not have id
      expect(leg.id).toBeUndefined();
    }
    // But required fields are there
    expect(apiPos.legs[0].kind).toBeDefined();
    expect(apiPos.legs[0].strike).toBeDefined();
    expect(apiPos.legs[0].expiry_days).toBeDefined();
    expect(apiPos.legs[0].quantity).toBeDefined();
  });
});

// === Phase B — stock legs & new presets ===
describe("Phase B: stock legs and income presets", () => {
  it("covered_call preset builds stock + short call", () => {
    usePosition.getState().applyPreset("covered_call");
    const legs = usePosition.getState().legs;
    expect(legs).toHaveLength(2);
    expect(legs[0].kind).toBe("stock");
    expect(legs[0].quantity).toBe(1);
    expect(legs[1].kind).toBe("call");
    expect(legs[1].quantity).toBe(-1);
    expect(legs[1].strike).toBeGreaterThan(500); // OTM call above spot
  });

  it("applyTickerSnapshot never snaps a stock leg's expiry", () => {
    usePosition.getState().applyPreset("covered_call");
    usePosition.getState().applyTickerSnapshot({
      ticker: "AAPL",
      spot: 230,
      as_of: "2026-07-05T00:00:00Z",
      expiries: [
        { date: "2026-07-10", days_to_expiry: 5 },
        { date: "2026-08-01", days_to_expiry: 27 },
      ],
      atm_expiry: "2026-08-01",
      atm_strike: 230,
      atm_iv: 0.28,
    });
    const legs = usePosition.getState().legs;
    const stock = legs.find((l) => l.kind === "stock")!;
    const call = legs.find((l) => l.kind === "call")!;
    expect(stock.expiry_days).toBe(0);          // untouched
    expect([5, 27]).toContain(call.expiry_days); // snapped to a real expiry
  });
});

// === I7 — preset legs snap to nearest available expiry after ticker fetch ===
describe("I7: preset legs snap to nearest available expiry", () => {
  it("each leg's expiry_days lands on an item from availableExpiries", () => {
    // Default position has expiry_days=30. The ticker snapshot's expiries
    // don't include exactly 30 — should snap to nearest.
    usePosition.getState().applyTickerSnapshot({
      ticker: "AAPL",
      spot: 230,
      as_of: "2026-05-25T00:00:00Z",
      expiries: [
        { date: "2026-05-30", days_to_expiry: 5 },
        { date: "2026-06-20", days_to_expiry: 26 },  // closest to 30
        { date: "2026-07-15", days_to_expiry: 51 },
      ],
      atm_expiry: "2026-06-20",
      atm_strike: 230,
      atm_iv: 0.28,
    });
    const dteList = usePosition.getState().availableExpiries.map((e) => e.days_to_expiry);
    for (const leg of usePosition.getState().legs) {
      expect(dteList).toContain(leg.expiry_days);
    }
    // Default expiry was 30 → should snap to 26 (closest)
    expect(usePosition.getState().legs[0].expiry_days).toBe(26);
  });
});
