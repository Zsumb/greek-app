"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sigma, Menu, X, ArrowRight } from "lucide-react";

const NAV = [
  { href: "/playground", label: "Playground" },
  { href: "/learn", label: "Learn" },
  { href: "/about", label: "About" },
];

/**
 * Site-wide navigation. Sticks to the top of the viewport, translucent
 * background so the maroon accent stripes on cards below can peek through
 * subtly on scroll.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:border-slate-800 dark:bg-slate-950/90 dark:supports-[backdrop-filter]:bg-slate-950/75">
      <div className="mx-auto flex h-16 max-w-[1382px] items-center justify-between gap-6 px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-900 dark:text-slate-100"
          aria-label="Options Greeks Playground — home"
        >
          <Sigma className="h-6 w-6 text-red-900 dark:text-red-400" />
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Options Greeks Playground
          </span>
          <span className="text-base font-semibold tracking-tight sm:hidden">
            OGP
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-red-900 dark:text-red-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop CTA */}
        <Link
          href="/playground"
          className="hidden items-center gap-1.5 rounded-md bg-red-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-950 md:inline-flex dark:bg-red-700 dark:hover:bg-red-800"
        >
          Try the Playground
          <ArrowRight className="h-4 w-4" />
        </Link>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-slate-200 bg-white px-6 py-4 md:hidden dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    active
                      ? "bg-slate-100 text-red-900 dark:bg-slate-800 dark:text-red-400"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/playground"
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md bg-red-900 px-4 py-2 text-sm font-semibold text-white hover:bg-red-950 dark:bg-red-700 dark:hover:bg-red-800"
            >
              Try the Playground
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
