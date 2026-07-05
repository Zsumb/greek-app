"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosition } from "@/lib/store";

/**
 * Header-level entry point to the chat assistant — same widget the floating
 * bubble opens, but discoverable where the user is actually working.
 */
export function AskAiButton() {
  const setChatOpen = usePosition((s) => s.setChatOpen);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => setChatOpen(true)}
      className="w-full border-red-900 text-red-900 hover:bg-red-50 hover:text-red-900 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-400"
    >
      <Sparkles className="mr-2 h-4 w-4" />
      Ask the AI about this position
    </Button>
  );
}
