"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** CSS-driven, not state-driven — both icons render always; `.dark` (see
 *  app/globals.css) toggles which one is visible. No mount-gate `useEffect` needed, so
 *  there is no hydration flash and nothing here violates the React Compiler's render
 *  purity rules (no setState-in-effect, no impure render). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      suppressHydrationWarning
      variant="ghost"
      size="icon"
      aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="size-8"
      
    >
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4 dark:block" aria-hidden="true" />
    </Button>
  );
}
