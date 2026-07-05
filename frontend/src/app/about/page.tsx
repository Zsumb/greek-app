import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

export const metadata = { title: "About — Options Greeks Playground" };

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-900 dark:text-red-400">
          About
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
          Why this tool exists
        </h1>
      </header>

      <div className="space-y-6 text-base leading-relaxed text-slate-700 dark:text-slate-300">
        <p>
          Most free options tools show you the payoff diagram and stop there.
          They tell you <em>what</em> happens, not <em>why</em>.
        </p>
        <p>
          This playground was built as a learning tool for retail options
          traders who are past the beginner stage — you know what a call is,
          you&apos;ve done a few wheels, and you&apos;re tired of &ldquo;trading
          by vibes.&rdquo; The differentiator is <strong>P&amp;L Decomposition</strong>:
          for any scenario you can imagine, the tool breaks your P&amp;L into
          Δ / Γ / Θ / Vega dollar contributions with the exact formula that
          produced each number.
        </p>
        <p>
          The tool is educational only. It does not execute trades, hold
          positions, or provide recommendations. It uses public 15-minute-delayed
          market data from yfinance.
        </p>

        <h2
          id="methodology"
          className="mt-10 scroll-mt-24 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
        >
          Methodology
        </h2>
        <p>
          All prices and Greeks are computed with the Black-Scholes model for{" "}
          <strong>European-style exercise</strong>, with{" "}
          <strong>no dividend adjustment</strong>, a{" "}
          <strong>flat risk-free rate</strong> (user-set, default 5%), and{" "}
          <strong>calendar-day/365</strong> time. Each leg is priced at its own
          implied volatility when one is set (or fetched from the chain);
          otherwise the position-level IV applies. Real US options are mostly
          American-style — for calls on non-dividend payers the difference is
          negligible, but <strong>deep-ITM puts and options around
          ex-dividend dates can diverge meaningfully</strong> from these model
          values. Market data is 15-minute-delayed via yfinance. The P&amp;L
          decomposition uses first-order Greeks plus ½Γ·dS²; the residual line
          shows what the approximation misses. Educational only — not an
          execution or pricing service.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Credits
        </h2>
        <p>
          Built by <strong>Sumbul Amin</strong> with <strong>Claude</strong> —
          a working example of an AI-assisted product build from spec to
          production. Backend in Python (FastAPI), frontend in Next.js +
          TypeScript, deployed on Railway and Vercel.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Not trading advice
        </h2>
        <p>
          Everything here is an educational simulation. It doesn&apos;t know
          your portfolio, risk tolerance, or financial situation. Any real
          trading decision is yours alone. Past model performance — including
          the walkthrough numbers used to validate the math — is not
          predictive of future results.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Feedback
        </h2>
        <p>
          Found a bug? Have a strategy you&apos;d like modeled? Want a new
          educational article in Learn? The best way to make this better is
          to tell me what confused you. Feedback goes directly into the
          backlog.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/playground"
            className="inline-flex items-center gap-1.5 rounded-md bg-red-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-950 dark:bg-red-700 dark:hover:bg-red-800"
          >
            Open the Playground
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/Zsumb/greek-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4" />
            Source on GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
