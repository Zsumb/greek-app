import { ArticleLayout } from "@/components/article-layout";

export const metadata = { title: "Understanding P&L decomposition — Options Greeks Playground" };

export default function Article() {
  return (
    <ArticleLayout
      kicker="The differentiator"
      title="Understanding P&L decomposition"
      intro="If someone says your P&L is +$540, the most useful follow-up isn't 'why?' — it's 'which Greek contributed how much?' That's decomposition."
    >
      <p>
        In the Playground&apos;s Time Machine, you&apos;ll see a scenario broken
        into four dollar contributions:
      </p>
      <ul className="list-disc pl-6">
        <li><strong>Δ contribution</strong> — dollars from the underlying moving</li>
        <li><strong>Γ contribution</strong> — dollars from your delta shifting during the move</li>
        <li><strong>Θ contribution</strong> — dollars from time passing</li>
        <li><strong>Vega contribution</strong> — dollars from implied volatility changing</li>
      </ul>
      <p>
        Plus a fifth number — the <strong>residual</strong> — which we&apos;ll
        come back to.
      </p>

      <h2>The formula behind each contribution</h2>
      <p>
        Each contribution comes from a first-order Taylor approximation. In
        plain terms:
      </p>
      <ul className="list-disc pl-6">
        <li>Δ contribution = <strong>initial Delta × dS</strong></li>
        <li>Γ contribution = <strong>½ × initial Gamma × dS²</strong></li>
        <li>Θ contribution = <strong>initial Theta × days forward</strong></li>
        <li>Vega contribution = <strong>initial Vega × Δ IV (in vol-points)</strong></li>
      </ul>
      <p>
        The Playground shows the formula next to each row, so you can watch
        the math happen with your actual numbers.
      </p>

      <h2>Why the residual exists</h2>
      <p>
        Greeks measure sensitivity <em>at a specific point</em>. As soon as
        the underlying moves, those sensitivities change too — gamma itself
        depends on price. Higher-order effects (like &ldquo;the change in
        gamma as spot moves&rdquo;) aren&apos;t captured by the first-order
        contributions. The residual is what&apos;s left over.
      </p>
      <p>
        A small residual (a few dollars) means the first-order Greeks tell
        the whole story. A large residual (more than ~10% of actual P&amp;L)
        means the shock was too big for the linear approximation — and the
        Playground shows an amber warning to tell you so.
      </p>

      <h2>Why this beats a payoff diagram</h2>
      <p>
        A payoff diagram shows you the destination. Decomposition shows you
        the journey. If a trade lost money, decomposition answers questions
        like: &ldquo;Did it lose because the stock moved against me, or because
        IV crushed after I put the trade on?&rdquo; Those are very different
        lessons.
      </p>
    </ArticleLayout>
  );
}
