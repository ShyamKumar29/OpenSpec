"use client";

import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { Breadcrumb } from "./breadcrumb";
import { DemoDataBadge } from "./demo-data-badge";
import { ThemeToggle } from "./theme-toggle";
import { useCommandPalette } from "@/lib/keyboard/registry";

export function Topbar() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { setOpen: setPaletteOpen } = useCommandPalette();

  return (
    <header className="border-border bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 border-b px-3 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 lg:hidden"
        aria-label="Open navigation"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="size-4" aria-hidden="true" />
      </Button>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-border border-b px-3 py-3">
            <SheetTitle className="text-left text-sm">OpenSpec</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <Breadcrumb />
      </div>

      <DemoDataBadge className="hidden sm:inline-flex" />

      {/* kbd carries its own text-foreground — the button's muted colour (4.34:1 at
          10px) fails WCAG AA; the hint glyph needs full contrast (axe color-contrast). */}
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 gap-2 sm:flex"
        onClick={() => setPaletteOpen(true)}
      >
        <Search className="text-muted-foreground size-3.5" aria-hidden="true" />
        <span className="text-muted-foreground">Search</span>
        <kbd className="metric border-border bg-muted text-foreground ml-1 rounded border px-1 text-[10px]">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 sm:hidden"
        aria-label="Search"
        onClick={() => setPaletteOpen(true)}
      >
        <Search className="size-4" aria-hidden="true" />
      </Button>

      <ThemeToggle />
    </header>
  );
}
