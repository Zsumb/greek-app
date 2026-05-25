"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { api } from "@/lib/api";
import { usePosition } from "@/lib/store";

/**
 * Ticker lookup: type a US-equity symbol, fetch live spot + expiries +
 * ATM IV from the backend, push them into the position store.
 */
export function TickerInput() {
  const [text, setText] = useState("");
  const ticker = usePosition((s) => s.ticker);
  const applyTickerSnapshot = usePosition((s) => s.applyTickerSnapshot);

  const mutation = useMutation({
    mutationFn: (t: string) => api.tickerSnapshot(t.toUpperCase()),
    onSuccess: (snap) => {
      applyTickerSnapshot(snap);
      setText("");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed);
  };

  const clearTicker = () => {
    // Soft-clear: drop the ticker badge + expiry dropdown, keep current S/IV/legs.
    usePosition.setState({ ticker: null, availableExpiries: [] });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Ticker (US equities, yfinance)
          </label>
          <Input
            type="text"
            placeholder="e.g. SPY, AAPL, NVDA"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="uppercase"
          />
        </div>
        <Button
          type="submit"
          disabled={mutation.isPending || !text.trim()}
          className="bg-gradient-to-br from-red-800 to-red-950 text-white hover:from-red-900 hover:to-red-950"
        >
          <Search className="mr-1 h-4 w-4" />
          {mutation.isPending ? "Fetching…" : "Fetch"}
        </Button>
      </form>

      {/* Status row */}
      {ticker && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary" className="font-mono">
            {ticker}
          </Badge>
          <span className="text-zinc-500">
            spot &amp; expiries loaded — leg DTE field now uses real expiries.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearTicker}
            className="ml-auto h-7"
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>
      )}

      {mutation.isError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Ticker fetch failed.</p>
          <p className="mt-1 break-words font-mono text-xs">
            {(mutation.error as Error).message}
          </p>
          <p className="mt-2 text-xs">
            yfinance can be flaky. Check the symbol, or try again.
          </p>
        </div>
      )}
    </div>
  );
}
