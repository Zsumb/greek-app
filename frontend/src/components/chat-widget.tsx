"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  MessageCircle,
  Send,
  Sparkles,
  X,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { api, type ChatMessage } from "@/lib/api";
import { usePosition } from "@/lib/store";

/**
 * Floating chat widget — Claude-backed Q&A about the user's current position.
 *
 * UX:
 *   - Bottom-right circular button shows/hides the panel
 *   - Panel pinned to bottom-right, scrollable message list, input + send
 *   - Each turn replays full history; server is stateless
 *   - "Reset" clears history without closing panel
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const toApiPosition = usePosition((s) => s.toApiPosition);
  const legs = usePosition((s) => s.legs);

  const scrollRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (next: ChatMessage[]) =>
      api.chat({ messages: next, position: toApiPosition() }),
    onSuccess: (res) => {
      setHistory((prev) => [...prev, { role: "assistant", content: res.content }]);
    },
  });

  // Auto-scroll to bottom on new messages / loading state changes
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, open, mutation.isPending]);

  function send() {
    const text = draft.trim();
    if (!text || mutation.isPending) return;
    const next: ChatMessage[] = [
      ...history,
      { role: "user", content: text },
    ];
    setHistory(next);
    setDraft("");
    mutation.mutate(next);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-red-900 text-white shadow-lg transition-transform hover:scale-105 hover:bg-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-900 focus-visible:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-800"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-30 flex h-[600px] max-h-[80vh] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border-t-4 border-t-red-900 bg-white shadow-2xl ring-1 ring-black/10 dark:bg-zinc-900">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-red-900 dark:text-red-400" />
              <div>
                <div className="text-sm font-semibold">Ask about your position</div>
                <div className="text-xs text-zinc-500">
                  Greek explanations, scenarios, suggestions
                </div>
              </div>
            </div>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistory([])}
                disabled={mutation.isPending}
                className="text-xs text-zinc-500"
              >
                Reset
              </Button>
            )}
          </div>

          {/* Message list */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {history.length === 0 && !mutation.isPending && (
              <EmptyHints hasPosition={legs.length > 0} />
            )}
            {history.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {mutation.isPending && (
              <MessageBubble
                message={{ role: "assistant", content: "Thinking…" }}
                isLoading
              />
            )}
            {mutation.isError && (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                <div className="flex items-center gap-1 font-medium">
                  <AlertCircle className="h-3 w-3" /> Couldn&apos;t reach the assistant
                </div>
                <p className="mt-1 break-words font-mono">
                  {(mutation.error as Error).message}
                </p>
              </div>
            )}
          </div>

          {/* Composer OR "Go to Playground" CTA when no position exists.
              The chat is fundamentally about the user's live position, so
              on non-playground pages we send them to /playground rather
              than showing a disabled input. */}
          {legs.length === 0 ? (
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
              <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">
                Chat answers use your live position — build one first.
              </p>
              <Link
                href="/playground"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-red-900 px-4 py-2 text-sm font-semibold text-white hover:bg-red-950 dark:bg-red-700 dark:hover:bg-red-800"
              >
                Open the Playground
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-[10px] text-zinc-400">
                Educational only. Not trading advice.
              </p>
            </div>
          ) : (
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Ask anything about your Greeks or run a scenario…"
                  rows={2}
                  disabled={mutation.isPending}
                  className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-red-900 focus:outline-none focus:ring-1 focus:ring-red-900 disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-red-400 dark:focus:ring-red-400"
                />
                <Button
                  type="button"
                  onClick={send}
                  disabled={!draft.trim() || mutation.isPending}
                  className="bg-red-900 hover:bg-red-950 dark:bg-red-700 dark:hover:bg-red-800"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-zinc-400">
                Educational only. Not trading advice.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// --- subcomponents ---

function MessageBubble({
  message,
  isLoading = false,
}: {
  message: ChatMessage;
  isLoading?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-red-900 text-white dark:bg-red-700"
            : "rounded-bl-sm bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        } ${isLoading ? "animate-pulse" : ""}`}
      >
        {message.content}
      </div>
    </div>
  );
}

function EmptyHints({ hasPosition }: { hasPosition: boolean }) {
  if (!hasPosition) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          The chat assistant reads your current position, runs scenarios
          through the simulator, and suggests adjustments — all with real
          numbers, not hallucinations.
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Head to the Playground to build a position, then come back here to
          ask about it.
        </p>
      </div>
    );
  }
  const hints = [
    "What does my delta mean in dollars?",
    "What happens if SPY drops 3% in 5 days?",
    "How can I reduce my theta bleed?",
    "Walk me through my P&L decomposition.",
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        I can read your current position, run scenarios through the simulator,
        and suggest adjustments. Try:
      </p>
      <ul className="space-y-1">
        {hints.map((h) => (
          <li
            key={h}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs italic text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            &ldquo;{h}&rdquo;
          </li>
        ))}
      </ul>
    </div>
  );
}
