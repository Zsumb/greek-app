/**
 * Pure functions to summarize a payoff curve into the numbers a trader cares
 * about: max profit, max loss, breakevens, and whether each tail is bounded.
 *
 * All inputs come from the backend's /position/payoff response.
 */
import type { PayoffResponse } from "./api";

export type PayoffSummary = {
  /** Negative = credit received, positive = debit paid. */
  netDebit: number;

  /** Max profit AT EXPIRY across the sampled spot range. */
  maxProfit: number;
  /** Slope at the right tail suggests profit grows beyond the sample. */
  maxProfitUnbounded: boolean;

  /** Max loss AT EXPIRY across the sampled spot range. */
  maxLoss: number;
  /** Slope at the left tail suggests loss grows beyond the sample. */
  maxLossUnbounded: boolean;

  /** Spot prices where pnl_at_expiry crosses zero (linearly interpolated). */
  breakevens: number[];

  /** Fraction of the sampled spot range where pnl_at_expiry > 0. */
  profitableRangeFraction: number;
};

/** Slope per $1 of spot at the tails — large magnitude => unbounded. */
const TAIL_SLOPE_THRESHOLD = 5;

export function summarizePayoff(payoff: PayoffResponse): PayoffSummary {
  const pts = payoff.points;
  const n = pts.length;

  const expiry = pts.map((p) => p.pnl_at_expiry);
  const spots = pts.map((p) => p.spot);

  const maxProfit = Math.max(...expiry);
  const maxLoss = Math.min(...expiry);

  // Per-$ slopes at the tails (use last/first few points for stability)
  const slopeAt = (i0: number, i1: number) =>
    (expiry[i1] - expiry[i0]) / (spots[i1] - spots[i0]);

  const leftSlope = slopeAt(0, Math.min(3, n - 1));
  const rightSlope = slopeAt(Math.max(0, n - 4), n - 1);

  // Unbounded "up" if right-tail slope is significantly positive
  const maxProfitUnbounded = rightSlope > TAIL_SLOPE_THRESHOLD;
  // Unbounded "down" if EITHER:
  //   - left-tail slope is significantly POSITIVE (P&L still falling as spot
  //     drops further — e.g. naked short put), OR
  //   - right-tail slope is significantly NEGATIVE (P&L still falling as spot
  //     rises further — e.g. naked short call).
  //
  // Note: a steeply *negative* left slope does NOT mean unbounded loss — it
  // means P&L is RISING as spot drops (long put / long straddle), so loss is
  // bounded at the V-shaped bottom of the curve.
  const maxLossUnbounded =
    leftSlope > TAIL_SLOPE_THRESHOLD || rightSlope < -TAIL_SLOPE_THRESHOLD;

  // Breakevens — linear-interpolate spot where pnl_at_expiry crosses zero
  const breakevens: number[] = [];
  for (let i = 1; i < n; i++) {
    const a = expiry[i - 1];
    const b = expiry[i];
    if (a === 0) breakevens.push(spots[i - 1]);
    if (a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b)) {
      const t = -a / (b - a);
      breakevens.push(spots[i - 1] + t * (spots[i] - spots[i - 1]));
    }
  }
  // Dedupe near-duplicates (within 1 cent)
  const dedupedBreakevens = breakevens.filter(
    (v, i, arr) => i === 0 || Math.abs(v - arr[i - 1]) > 0.01,
  );

  const profitableCount = expiry.filter((v) => v > 0).length;

  return {
    netDebit: payoff.initial_value,
    maxProfit,
    maxProfitUnbounded,
    maxLoss,
    maxLossUnbounded,
    breakevens: dedupedBreakevens,
    profitableRangeFraction: profitableCount / n,
  };
}
