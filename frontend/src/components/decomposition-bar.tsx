"use client";

/**
 * P&L Decomposition bar chart — the differentiator.
 * Horizontal bars centered on a zero line; positive bars extend right (green),
 * negative bars extend left (red). Each bar is labeled with the $ amount.
 */
import { Separator } from "@/components/ui/separator";

export type DecompRow = {
  label: string;
  value: number;
  emphasis?: boolean; // bolder styling for totals
  /** Optional calculation string displayed as a subtitle under the $ value. */
  calc?: string;
};

export function DecompositionBar({
  rows,
  emphasizedAt,
}: {
  rows: DecompRow[];
  /** Index BEFORE which to draw a divider (e.g., between Vega and Residual). */
  emphasizedAt?: number;
}) {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)), 1);

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={row.label}>
          {emphasizedAt === i && <Separator className="my-3" />}
          <DecompRow row={row} maxAbs={maxAbs} />
        </div>
      ))}
    </div>
  );
}

function DecompRow({ row, maxAbs }: { row: DecompRow; maxAbs: number }) {
  const pct = (Math.abs(row.value) / maxAbs) * 100;
  const isPos = row.value >= 0;
  const labelClass = row.emphasis ? "font-semibold" : "";

  return (
    <div className="grid grid-cols-[110px_1fr_240px] items-start gap-3 text-sm">
      <div className={`pt-0.5 ${labelClass} text-zinc-700 dark:text-zinc-300`}>
        {row.label}
      </div>

      {/* Bar: two halves, left for negative, right for positive */}
      <div className="relative mt-1 h-5">
        {/* Center zero line */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-zinc-400/60 dark:bg-zinc-600" />
        {/* Negative bar (extends left from center) */}
        {!isPos && (
          <div
            className="absolute right-1/2 top-0 h-full rounded-l-sm bg-red-500/80 dark:bg-red-600"
            style={{ width: `${pct / 2}%` }}
          />
        )}
        {/* Positive bar (extends right from center) */}
        {isPos && (
          <div
            className="absolute left-1/2 top-0 h-full rounded-r-sm bg-emerald-500/80 dark:bg-emerald-600"
            style={{ width: `${pct / 2}%` }}
          />
        )}
      </div>

      {/* Value + optional calculation subtitle */}
      <div className="text-right">
        <div
          className={`font-mono ${labelClass} ${
            isPos
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-700 dark:text-red-400"
          }`}
        >
          {row.value >= 0 ? "+" : ""}${row.value.toFixed(2)}
        </div>
        {row.calc && (
          <div className="mt-1 font-sans text-xs leading-snug text-zinc-500">
            {row.calc}
          </div>
        )}
      </div>
    </div>
  );
}
