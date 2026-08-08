"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Light and dark, both tested (docs/06-frontend.md §5). Class-based so Tailwind's
 *  `.dark` variant (see app/globals.css) does the rest. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
