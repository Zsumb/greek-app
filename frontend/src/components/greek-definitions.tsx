"use client";

/**
 * Plain-English definitions of each Greek.
 *
 * Exports a presentational `GreekDefinitionsList` (just the dl grid) so the
 * same content can be reused inside a Dialog without dragging the Card chrome.
 */
export function GreekDefinitionsList() {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
      <Def
        term="Position value"
        def="Current dollar value of the whole position. Negative = net credit received."
      />
      <Def
        term="Delta (Δ)"
        def="Dollars your P&L changes per $1 move in the underlying. Long call = positive, long put = negative. Your directional exposure."
      />
      <Def
        term="Gamma (Γ)"
        def="How fast delta changes per $1 move. High gamma = your exposure shifts quickly. Peaks near the strike."
      />
      <Def
        term="Theta (Θ) / day"
        def="Dollars gained or lost per calendar day from time decay. Negative for long options (you pay for time), positive for short (you collect it)."
      />
      <Def
        term="Vega / vol-pt"
        def="Dollars per 1 vol-point change in implied volatility. Positive = you benefit from rising IV; negative = you benefit from IV crush."
      />
      <Def
        term="Rho / 1%"
        def="Dollars per 1% move in interest rates. Usually tiny for short-dated options; matters for LEAPs."
      />
    </dl>
  );
}

function Def({ term, def }: { term: string; def: string }) {
  return (
    <div>
      <dt className="font-medium text-slate-900 dark:text-slate-100">{term}</dt>
      <dd className="mt-1 text-slate-600 leading-snug dark:text-slate-400">
        {def}
      </dd>
    </div>
  );
}
