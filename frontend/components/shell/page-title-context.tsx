"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface PageTitleContextValue {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>{children}</PageTitleContext.Provider>
  );
}

function usePageTitleContext(): PageTitleContextValue {
  const ctx = useContext(PageTitleContext);
  if (!ctx)
    throw new Error("usePageTitle must be used within PageTitleProvider (the shell layout)");
  return ctx;
}

/**
 * A page calls this to override the breadcrumb's final segment with real data (e.g. a
 * record's MPN once fetched) — the breadcrumb slot itself never changes; only what a
 * page tells it to show does. Clears itself on unmount so the next route starts fresh.
 */
export function usePageTitle(title: string | null): void {
  const { setTitle } = usePageTitleContext();
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
}

export function useCurrentPageTitle(): string | null {
  return usePageTitleContext().title;
}
