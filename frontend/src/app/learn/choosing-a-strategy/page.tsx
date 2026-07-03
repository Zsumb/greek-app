import { ArticleLayout } from "@/components/article-layout";

export const metadata = { title: "Choosing a strategy — Options Greeks Playground" };

export default function Article() {
  return (
    <ArticleLayout
      kicker="The playbook"
      title="Choosing a strategy"
      intro="Every options strategy is a bet on some combination of direction, volatility, and time. Match the strategy to what you actually believe."
    >
      <h2>Three questions to ask first</h2>
      <ol className="list-decimal pl-6">
        <li>
          <strong>What do I think happens to the price?</strong> Up, down, or
          nothing?
        </li>
        <li>
          <strong>What&apos;s implied vol doing?</strong> Rich (elevated,
          about to crush), cheap (low, about to rise), or fair?
        </li>
        <li>
          <strong>Over what timeframe?</strong> Days, weeks, months.
        </li>
      </ol>
      <p>
        Your answers point to a strategy. Here&apos;s a starting map.
      </p>

      <h2>Long call — you think the stock rises</h2>
      <p>
        Buy a call. Positive delta, positive gamma, negative theta, positive
        vega. Best when you expect a decent move and IV isn&apos;t already
        elevated. Downside: unlimited theta bleed if the stock does nothing.
      </p>

      <h2>Long put — you think the stock falls</h2>
      <p>
        Same shape as long call but flipped. Positive vega, so it also benefits
        if IV rises (which often happens on the way down).
      </p>

      <h2>Bull call spread — you think the stock rises modestly</h2>
      <p>
        Long a lower-strike call, short a higher-strike call. Bounded profit,
        bounded loss. Cheaper than a naked long call, but you cap your upside.
        Best when your view is directional but not aggressive.
      </p>

      <h2>Iron condor — you think the stock does nothing</h2>
      <p>
        Short a call spread + short a put spread. Positive theta (you collect
        decay), negative gamma (moves hurt), negative vega (IV rise hurts).
        Best when IV is elevated and you expect it to compress <em>without</em>
        {" "}a big move. Time decay is your friend.
      </p>

      <h2>Long straddle — you think something big is coming</h2>
      <p>
        Long a call + long a put at the same strike. Positive vega,
        negative theta. Best when you expect either a directional move or an
        IV expansion <em>before</em> the event you&apos;re trading. Losing
        trade: nothing happens and IV crushes at the same time.
      </p>

      <h2>How to use the Playground to pick</h2>
      <p>
        Build one of the presets. Set your ticker. Run the Time Machine with
        your expected scenario. Then run it again with the opposite scenario.
        If both outcomes leave you comfortable, you have a real edge. If one
        of them wipes you out, you&apos;re just betting on your view — size
        smaller.
      </p>
    </ArticleLayout>
  );
}
