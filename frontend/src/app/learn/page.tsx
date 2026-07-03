/**
 * Learn — index of educational articles. Each article is its own page
 * under /learn/<slug>. Article stubs are simple TSX pages for now; move
 * to MDX when the volume grows.
 */
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

const ARTICLES = [
  {
    slug: "what-are-the-greeks",
    title: "What are the Greeks?",
    kicker: "The vocabulary",
    summary:
      "Δ, Γ, Θ, Vega, ρ — one sentence each, in plain English. Which one matters for which decision.",
  },
  {
    slug: "pnl-decomposition",
    title: "Understanding P&L decomposition",
    kicker: "The differentiator",
    summary:
      "Why your P&L can be broken into Δ-contribution, Γ-contribution, Θ-contribution, and Vega-contribution — and what the residual means.",
  },
  {
    slug: "choosing-a-strategy",
    title: "Choosing a strategy",
    kicker: "The playbook",
    summary:
      "Long call vs. bull spread vs. iron condor — how to pick based on your directional view, IV, and risk appetite.",
  },
  {
    slug: "reading-the-payoff-diagram",
    title: "Reading the payoff diagram",
    kicker: "The fundamentals",
    summary:
      "P&L today vs. at expiry, breakevens, max profit/loss — how to read the two curves and use them to size your risk.",
  },
];

export default function LearnIndex() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14">
      <header className="mb-10">
        <p className="inline-flex items-center gap-2 rounded-full bg-red-900/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-900 dark:bg-red-400/10 dark:text-red-400">
          <BookOpen className="h-3 w-3" />
          Learn
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
          Options Greeks primer
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Short reads that pair with the Playground. Each article uses the tool
          to demonstrate the concept — no chalkboard math without a live
          example.
        </p>
      </header>

      <ul className="space-y-4">
        {ARTICLES.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/learn/${a.slug}`}
              className="group block rounded-xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-red-900 dark:text-red-400">
                {a.kicker}
              </p>
              <h2 className="mt-1 flex items-center justify-between gap-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                <span>{a.title}</span>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-red-900 dark:group-hover:text-red-400" />
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {a.summary}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-slate-500">
        More articles coming. Have a topic you&apos;d like covered?{" "}
        <Link href="/about" className="text-red-900 underline dark:text-red-400">
          Get in touch
        </Link>
        .
      </p>
    </main>
  );
}
