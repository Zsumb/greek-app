import { ArticleLayout } from "@/components/article-layout";

export const metadata = { title: "What are the Greeks? — Options Greeks Playground" };

export default function Article() {
  return (
    <ArticleLayout
      kicker="The vocabulary"
      title="What are the Greeks?"
      intro="Five Greek-letter numbers that tell you exactly how your options position will react to changes in price, time, and volatility."
    >
      <p>
        The &ldquo;Greeks&rdquo; are named after Greek letters because that&apos;s
        how they show up in the Black-Scholes math. But you don&apos;t need
        the math to use them — each one has a plain-English meaning in dollars.
      </p>

      <h2>Delta (Δ) — the directional exposure</h2>
      <p>
        <strong>Dollars your P&amp;L changes per $1 move in the underlying.</strong>
        {" "}A long call has positive delta (you make money when the stock goes up);
        a long put has negative delta (you make money when the stock goes down).
        A delta of 54 means: SPY goes up $1, you gain about $54.
      </p>

      <h2>Gamma (Γ) — how fast delta changes</h2>
      <p>
        <strong>How much your delta shifts per $1 spot move.</strong>{" "}
        High gamma means your directional exposure changes quickly — a small
        rally can turn a slightly-bullish position into a strongly-bullish
        one. Gamma peaks near the strike and fades away from it.
      </p>

      <h2>Theta (Θ) — the daily bleed</h2>
      <p>
        <strong>Dollars gained or lost per calendar day from time decay.</strong>{" "}
        Negative for long options (you pay for time), positive for short
        options (you collect it). If your theta is −$22.49, you&apos;ll lose
        about $22 tomorrow if nothing else changes.
      </p>

      <h2>Vega — the volatility knob</h2>
      <p>
        <strong>Dollars per 1 vol-point move in implied volatility.</strong>{" "}
        Positive vega = you benefit from rising IV. Negative vega = you benefit
        from IV crush. Earnings, Fed announcements, and other event risks
        move vega positions the most.
      </p>

      <h2>Rho (ρ) — the interest-rate sensitivity</h2>
      <p>
        <strong>Dollars per 1% move in the risk-free rate.</strong>{" "}
        Usually the smallest Greek for short-dated options. Matters mostly
        for LEAPs (long-dated options) and shifts in the yield curve.
      </p>

      <h2>Which one matters when?</h2>
      <ul className="list-disc pl-6">
        <li><strong>Directional bet:</strong> watch delta (and gamma if you might be wrong).</li>
        <li><strong>Selling premium (theta plays):</strong> watch theta and gamma together.</li>
        <li><strong>Trading around events:</strong> watch vega — the IV crush after earnings is real.</li>
        <li><strong>LEAPs / long-dated bets:</strong> rho starts to matter, so does re-computing all of the above regularly.</li>
      </ul>
    </ArticleLayout>
  );
}
