import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Shared wrapper for /learn/* article pages. Provides consistent typography,
 * back-nav, and a "Try it in the Playground" CTA at the bottom.
 */
export function ArticleLayout({
  kicker,
  title,
  intro,
  children,
}: {
  kicker: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Learn
      </Link>

      <header className="mt-6 mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-900 dark:text-red-400">
          {kicker}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
          {title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-700 dark:text-slate-300">
          {intro}
        </p>
      </header>

      <article className="space-y-6 text-base leading-relaxed text-slate-700 dark:text-slate-300 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_h2]:dark:text-slate-100 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:dark:text-slate-100 [&_p]:leading-relaxed [&_strong]:text-slate-900 [&_strong]:dark:text-slate-100">
        {children}
      </article>

      <div className="mt-16 rounded-xl border border-red-900/20 bg-red-900/5 p-6 dark:border-red-400/30 dark:bg-red-400/10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Try it in the Playground
        </h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          The concepts above are more concrete when you can see them move.
          Build a position and watch the numbers.
        </p>
        <Link
          href="/playground"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-red-900 px-4 py-2 text-sm font-semibold text-white hover:bg-red-950 dark:bg-red-700 dark:hover:bg-red-800"
        >
          Open the Playground
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}
