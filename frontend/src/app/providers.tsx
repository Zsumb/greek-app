"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * App-wide providers (client component).
 * TanStack Query gives us caching, retries, and loading/error states for free.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  // Create the QueryClient inside state so it's stable across re-renders
  // (a fresh instance on every render would defeat its cache).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
