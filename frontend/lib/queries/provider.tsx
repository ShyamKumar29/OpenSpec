"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Server data lives in TanStack Query — caching, invalidation, background refetch, and
 * the review queue's prefetch requirement all depend on it (docs/06-frontend.md §6).
 * One client per browser session; a fresh one per SSR request (the `useState`
 * initializer avoids sharing state across requests/users).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
