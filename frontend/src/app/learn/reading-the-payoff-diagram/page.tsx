import { ArticleLayout } from "@/components/article-layout";

export const metadata = { title: "Reading the payoff diagram — Options Greeks Playground" };

export default function Article() {
  return (
    <ArticleLayout
      kicker="The fundamentals"
      title="Reading the payoff diagram"
      intro="Two curves, four numbers. Once you know how to read them, every options position tells you exactly where it wins and where it loses."
    >
      <h2>The two curves</h2>
      <p>
        The Playground&apos;s payoff chart shows two lines against a range of
        possible spot prices:
      </p>
      <ul className="list-disc pl-6">
        <li>
          <strong>Solid green</strong> — P&amp;L <em>at expiration</em>.
          This is the clean, kinked line most textbooks show. Options that
          finish out-of-the-money go to zero; in-the-money options settle at
          intrinsic value.
        </li>
        <li>
          <strong>Dotted blue</strong> — P&amp;L <em>today</em>. This is
          smoother because it includes the remaining time value in the
          options. As expiry approaches, this curve morphs into the green one.
        </li>
      </ul>

      <h2>The four summary numbers</h2>
      <p>
        Every payoff card shows four metrics up top. Here&apos;s what each means:
      </p>
      <ul className="list-disc pl-6">
        <li>
          <strong>Net debit / credit</strong> — dollars paid (debit) or
          received (credit) to open the position. Long premium = debit.
          Short premium = credit.
        </li>
        <li>
          <strong>Max profit</strong> — the highest point the green curve
          reaches. &ldquo;Unlimited&rdquo; means the tail keeps rising —
          typical for long calls (up) or long puts (down).
        </li>
        <li>
          <strong>Max loss</strong> — the lowest point. &ldquo;Unlimited&rdquo;
          means naked short exposure — a naked short call, for instance,
          loses more every dollar the stock rises.
        </li>
        <li>
          <strong>Breakeven(s)</strong> — the spot prices where the green
          line crosses zero. Between two breakevens, you make money at
          expiry; outside them, you lose. Simple positions have one
          breakeven; multi-leg strategies often have two.
        </li>
      </ul>

      <h2>How to use the two curves</h2>
      <p>
        Read them together. The gap between blue and green shows the
        <em> remaining time value</em> at each spot. If the gap is huge, you
        have room for the position to move — but you&apos;re also paying for
        it (theta). If the gap is small, most of the time value is gone and
        the trade is close to its terminal state.
      </p>

      <h2>Vertical reference lines</h2>
      <ul className="list-disc pl-6">
        <li>
          <strong>Dashed vertical</strong> — current spot price. Where you
          are right now.
        </li>
        <li>
          <strong>Dotted vertical(s)</strong> — breakevens. Where you
          transition from losing to winning at expiry.
        </li>
      </ul>

      <h2>Common gotchas</h2>
      <p>
        The chart is a snapshot with today&apos;s IV. If IV changes, both
        curves shift — that&apos;s Vega at work. The Time Machine lets you
        simulate that shift and see how your position responds.
      </p>
      <p>
        Also: the Playground automatically widens the spot range for
        high-IV positions so both breakevens are visible. If you don&apos;t
        see a breakeven for a straddle, that&apos;s a sign the IV is high
        enough that the breakeven falls outside the default view — the app
        handles this for you.
      </p>
    </ArticleLayout>
  );
}
