/**
 * Tests for `summarizePayoff` — the function that turns the backend's
 * /position/payoff response into max profit / max loss / breakevens.
 *
 * Several of these guard against regressions in the unbounded-tail
 * detector that we tuned in the matrix:
 *   - D3, I8: long straddle max loss must be BOUNDED (the bug we fixed)
 *   - I9, D5, D6: naked shorts must be flagged UNBOUNDED on the correct tail
 */
import { describe, it, expect } from "vitest";

import { summarizePayoff } from "./payoff-summary";
import type { PayoffResponse } from "./api";

// === Helper: build a synthetic payoff curve from a per-spot pnl_at_expiry fn ===

function makePayoff(
  initial_value: number,
  spotMin: number,
  spotMax: number,
  numPoints: number,
  pnlExpiry: (S: number) => number,
  pnlToday?: (S: number) => number,
): PayoffResponse {
  const step = (spotMax - spotMin) / (numPoints - 1);
  const points = Array.from({ length: numPoints }, (_, i) => {
    const spot = spotMin + i * step;
    return {
      spot,
      pnl_at_expiry: pnlExpiry(spot),
      pnl_today: pnlToday ? pnlToday(spot) : pnlExpiry(spot),
    };
  });
  // Tests don't override entry prices, so cost_basis mirrors initial_value —
  // same invariant the backend guarantees.
  return { initial_value, cost_basis: initial_value, points };
}

// === Specific position shapes (per contract = 100 shares) ===

function longCall(strike: number, premium: number) {
  return (S: number) => Math.max(S - strike, 0) * 100 - premium;
}

function longPut(strike: number, premium: number) {
  return (S: number) => Math.max(strike - S, 0) * 100 - premium;
}

function shortCall(strike: number, premium: number) {
  return (S: number) => premium - Math.max(S - strike, 0) * 100;
}

function shortPut(strike: number, premium: number) {
  return (S: number) => premium - Math.max(strike - S, 0) * 100;
}

function longStraddle(strike: number, totalPremium: number) {
  return (S: number) =>
    Math.max(S - strike, 0) * 100 + Math.max(strike - S, 0) * 100 - totalPremium;
}

function ironCondor(
  longPutK: number,
  shortPutK: number,
  shortCallK: number,
  longCallK: number,
  netCredit: number,
) {
  // Receive credit upfront; lose at the wings.
  return (S: number) => {
    const longPutP = Math.max(longPutK - S, 0) * 100;
    const shortPutP = -Math.max(shortPutK - S, 0) * 100;
    const shortCallP = -Math.max(S - shortCallK, 0) * 100;
    const longCallP = Math.max(S - longCallK, 0) * 100;
    return longPutP + shortPutP + shortCallP + longCallP + netCredit;
  };
}

// ============================================================================

describe("summarizePayoff", () => {
  // === D3 (a.k.a. I8) — the bug we just fixed ===
  it("D3: long straddle max LOSS is bounded at the bottom (NOT unlimited)", () => {
    // Spot range $460-$540 around K=500; total premium $2,288
    const p = makePayoff(2288, 460, 540, 201, longStraddle(500, 2288));
    const s = summarizePayoff(p);
    expect(s.maxLossUnbounded).toBe(false);
    expect(s.maxLoss).toBeCloseTo(-2288, -1);   // bounded loss = -premium
    expect(s.maxProfitUnbounded).toBe(true);    // both tails climb
    expect(s.breakevens.length).toBe(2);
  });

  // === D4 — long call: profit unlimited, loss bounded
  it("D4: long call has UNLIMITED profit and BOUNDED loss", () => {
    const p = makePayoff(1247, 450, 550, 201, longCall(500, 1247));
    const s = summarizePayoff(p);
    expect(s.maxProfitUnbounded).toBe(true);
    expect(s.maxLossUnbounded).toBe(false);
    expect(s.maxLoss).toBeCloseTo(-1247, -1);
    expect(s.breakevens.length).toBe(1);
    expect(s.breakevens[0]).toBeCloseTo(500 + 12.47, 0); // strike + premium-per-share
  });

  // === D5 — naked short call: loss unlimited on the RIGHT tail
  it("D5: naked short call → UNLIMITED loss (right tail)", () => {
    const p = makePayoff(-1247, 450, 550, 201, shortCall(500, 1247));
    const s = summarizePayoff(p);
    expect(s.maxLossUnbounded).toBe(true);
    expect(s.netDebit).toBeLessThan(0); // credit received
  });

  // === D6 — naked short put: loss unlimited on the LEFT tail
  it("D6: naked short put → UNLIMITED loss (left tail)", () => {
    const p = makePayoff(-1043, 450, 550, 201, shortPut(500, 1043));
    const s = summarizePayoff(p);
    expect(s.maxLossUnbounded).toBe(true);
    expect(s.netDebit).toBeLessThan(0); // credit received
  });

  // === D7 — iron condor: bounded both sides, two breakevens
  it("D7: iron condor is bounded both sides and has 2 breakevens", () => {
    const p = makePayoff(
      -600, 460, 540, 201,
      ironCondor(480, 490, 510, 520, 600),
    );
    const s = summarizePayoff(p);
    expect(s.maxLossUnbounded).toBe(false);
    expect(s.maxProfitUnbounded).toBe(false);
    // Credit-received iron condor: max profit ≈ credit; max loss ≈ -(wing − credit)
    expect(s.maxProfit).toBeCloseTo(600, -1);
    expect(s.maxLoss).toBeCloseTo(-400, -1);
    expect(s.breakevens.length).toBe(2);
  });

  // === D8 — net credit display flips label correctly
  it("D8: net credit flips sign (initial_value < 0 means credit received)", () => {
    const p = makePayoff(
      -600, 460, 540, 201,
      ironCondor(480, 490, 510, 520, 600),
    );
    const s = summarizePayoff(p);
    expect(s.netDebit).toBeLessThan(0); // negative netDebit == credit
  });

  // === D9 — bull call spread: exactly 1 breakeven, bounded both sides
  it("D9: bull call spread has 1 breakeven and is bounded both sides", () => {
    // Long 500 call ($12 prem) - Short 510 call ($7 prem) → net debit $500 per contract
    const debit = 500;
    const pnl = (S: number) => {
      const longCallP = Math.max(S - 500, 0) * 100;
      const shortCallP = -Math.max(S - 510, 0) * 100;
      return longCallP + shortCallP - debit;
    };
    const p = makePayoff(debit, 480, 530, 201, pnl);
    const s = summarizePayoff(p);
    expect(s.maxProfitUnbounded).toBe(false);
    expect(s.maxLossUnbounded).toBe(false);
    expect(s.maxProfit).toBeCloseTo(500, -1);  // (510-500)*100 - debit
    expect(s.maxLoss).toBeCloseTo(-debit, -1);
    expect(s.breakevens.length).toBe(1);
    expect(s.breakevens[0]).toBeCloseTo(505, 0);
  });

  // === I9 — same as D6 but explicitly tagged from the I-section
  it("I9: summarizePayoff naked short put → maxLossUnbounded === true", () => {
    const p = makePayoff(-800, 400, 600, 201, shortPut(500, 800));
    const s = summarizePayoff(p);
    expect(s.maxLossUnbounded).toBe(true);
  });
});
