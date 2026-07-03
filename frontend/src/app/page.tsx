/**
 * Landing page — hero, features, how-it-works, CTA.
 * Playground itself lives at /playground.
 */
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-[1382px] px-6">
      {/* ================================================================
          HERO
         ================================================================ */}
      <section className="pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-red-900/20 bg-red-900/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-900 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400">
            Options education · Free
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl dark:text-slate-100">
            Every options trade{" "}
            <span className="text-red-900 dark:text-red-400">tells a story.</span>
            <br />
            This tool lets you read it.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
            See the breakdown of your option P&amp;L into{" "}
            <span className="font-semibold text-red-900 dark:text-red-400">
              Δ / Γ / Θ / Vega
            </span>{" "}
            contributions in dollars. Simulate any scenario. Ask an AI trained
            on your live position — all before you risk capital.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/playground"
              className="inline-flex items-center gap-2 rounded-md bg-red-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-red-950 dark:bg-red-700 dark:hover:bg-red-800"
            >
              Open the Playground
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Read the Greeks primer
            </Link>
          </div>
        </div>

      </section>

      {/* ================================================================
          FEATURE GRID
         ================================================================ */}
      <section className="border-t border-slate-200 py-16 sm:py-20 dark:border-slate-800">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
            What you get
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Four features most free options tools skip.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6" />}
            title="P&L Decomposition"
            body="Break any scenario's P&L into Δ / Γ / Θ / Vega dollar contributions — with the formula visible. The differentiator."
          />
          <FeatureCard
            icon={<Clock className="h-6 w-6" />}
            title="Time Machine"
            body="Sliders for days, spot shock, IV shock — plus preset scenarios that isolate one Greek at a time, and a custom-scenario input for exact values."
          />
          <FeatureCard
            icon={<MessageSquare className="h-6 w-6" />}
            title="AI Assistant"
            body="Claude reads your live position and calls the actual simulator to answer 'what if' questions. Real numbers, not hallucinations."
          />
          <FeatureCard
            icon={<TrendingUp className="h-6 w-6" />}
            title="Live Market Data"
            body="Type any US ticker — spot, real expiry dates, and ATM implied volatility autofill from yfinance."
          />
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS
         ================================================================ */}
      <section className="border-t border-slate-200 py-16 sm:py-20 dark:border-slate-800">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
            How it works
          </h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
          <Step
            n="1"
            title="Build a position"
            body="Pick a preset (long call, iron condor, straddle…) or add custom legs. Fetch a live US ticker to autofill spot, expiries, and ATM IV."
          />
          <Step
            n="2"
            title="Read your Greeks in dollars"
            body="Δ / Γ / Θ / Vega / Rho aggregated across all your legs. Every value comes with a plain-English interpretation."
          />
          <Step
            n="3"
            title="Simulate before you trade"
            body="Move time forward. Shock the underlying. Jolt IV. See your P&L broken down by Greek — with the exact formula that produced each number."
          />
        </div>
      </section>

      {/* ================================================================
          WHO IT'S FOR
         ================================================================ */}
      <section className="border-t border-slate-200 py-16 sm:py-20 dark:border-slate-800">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
            Who it&apos;s for
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-700 dark:text-slate-300">
            <span className="font-semibold">Retail options traders, 6-24 months in</span>{" "}
            — you know what a call is, you&apos;ve done a wheel or two, but the
            Greeks still feel like homework. You want to stop &ldquo;trading by
            vibes&rdquo; and start understanding{" "}
            <em>why</em> your trades work or don&apos;t.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-slate-700 dark:text-slate-300">
            Not for institutional traders (you have Bloomberg). Not for pure
            beginners (start with a basic options course first).
          </p>
        </div>
      </section>

      {/* ================================================================
          FINAL CTA
         ================================================================ */}
      <section className="border-t border-slate-200 py-16 sm:py-24 dark:border-slate-800">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
            See the Greeks in dollars.
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Free. No sign-up. Educational only.
          </p>
          <Link
            href="/playground"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-red-900 px-8 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-red-950 dark:bg-red-700 dark:hover:bg-red-800"
          >
            Open the Playground
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}

// ============================================================================

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border-t-4 border-t-red-900 bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-lg dark:border-t-red-400 dark:bg-slate-900 dark:ring-slate-800">
      <div className="mb-4 inline-flex rounded-lg bg-red-900/10 p-2.5 text-red-900 dark:bg-red-400/10 dark:text-red-400">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {body}
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-900 text-lg font-bold text-white dark:bg-red-700">
        {n}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {body}
      </p>
    </div>
  );
}
