"use client";

/**
 * Small `matchMedia` hook — used to switch the document pane between an inline split
 * view and a drawer at the same `lg` breakpoint the record detail grid itself switches
 * at (docs/06-frontend.md §9). Built on `useSyncExternalStore` — the React-endorsed
 * pattern for subscribing to external browser state (matchMedia is exactly the textbook
 * case): `getServerSnapshot` returns `false` so SSR and the client's first hydration
 * pass agree (no mismatch warning), and the real viewport value takes over immediately
 * after hydration.
 */
import { useSyncExternalStore } from "react";

function subscribe(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

function getServerSnapshot(): boolean {
  return false;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    getServerSnapshot,
  );
}
