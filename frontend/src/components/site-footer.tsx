import Link from "next/link";
import { Sigma } from "lucide-react";

/**
 * Global footer — same on every page. Includes the disclaimer,
 * credit line, and a small nav for accessibility/SEO.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="mx-auto max-w-[1382px] px-6 py-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Sigma className="h-5 w-5 text-red-900 dark:text-red-400" />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Options Greeks Playground
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/playground" className="hover:text-slate-900 dark:hover:text-slate-100">
              Playground
            </Link>
            <Link href="/learn" className="hover:text-slate-900 dark:hover:text-slate-100">
              Learn
            </Link>
            <Link href="/about" className="hover:text-slate-900 dark:hover:text-slate-100">
              About
            </Link>
            <Link
              href="/about#methodology"
              className="hover:text-slate-900 dark:hover:text-slate-100"
            >
              Methodology
            </Link>
          </nav>
        </div>
        <hr className="my-6 border-slate-200 dark:border-slate-800" />
        <div className="flex flex-col items-start justify-between gap-2 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>Educational tool only. Not trading advice.</p>
          <p>Created by — Sumbul Amin, Claude</p>
        </div>
      </div>
    </footer>
  );
}
