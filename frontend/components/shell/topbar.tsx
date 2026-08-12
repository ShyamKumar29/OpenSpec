"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { LiveStatusPill, PipelineStrip } from "./pipeline-strip";
import { useCommandPalette } from "@/lib/keyboard/registry";

/**
 * The top chrome bar. Per the Stitch export it is a high-contrast near-black slab
 * "bolted" to the top of the interface (DESIGN.md §Header Depth) carrying the wordmark,
 * the live pipeline readout, search, and run status — deliberately *not* the page's own
 * title, which belongs to `PageHeader` inside the parchment workspace below.
 *
 * The breadcrumb moved out of this bar and onto the workspace strip (`AppShell`), which
 * both matches the Stitch pages (breadcrumb sits above the page title, e.g. the `why`
 * screen) and frees the chrome for the pipeline strip.
 */
export function Topbar() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { setOpen: setPaletteOpen } = useCommandPalette();

  return (
    <header className="bg-chrome border-chrome-border text-chrome-foreground sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="text-chrome-foreground hover:bg-chrome-accent hover:text-chrome-foreground size-8 lg:hidden"
        aria-label="Open navigation"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="size-4" aria-hidden="true" />
      </Button>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-border border-b px-3 py-3">
            <SheetTitle className="text-left text-sm font-black tracking-tight uppercase">
              OpenSpec
            </SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <Link
        href="/"
        className="focus-visible:ring-chrome-foreground shrink-0 rounded-sm text-base font-black tracking-tight uppercase focus-visible:ring-2 focus-visible:outline-none"
      >
        OpenSpec
      </Link>

      <span aria-hidden="true" className="bg-chrome-border hidden h-5 w-px xl:block" />

      <PipelineStrip />

      <div className="flex-1" />

      {/* kbd carries its own full-contrast colour — a muted glyph at 10px fails WCAG AA
          (axe color-contrast). */}
      <Button
        variant="ghost"
        size="sm"
        className="border-chrome-border bg-chrome-accent text-chrome-foreground/75 hover:bg-chrome-accent hover:text-chrome-foreground hidden h-8 gap-2 rounded-sm border sm:flex"
        onClick={() => setPaletteOpen(true)}
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span className="metric text-xs">Search catalog…</span>
        <kbd className="metric border-chrome-border text-chrome-foreground ml-1 rounded-sm border px-1 text-[10px]">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-chrome-foreground hover:bg-chrome-accent hover:text-chrome-foreground size-8 sm:hidden"
        aria-label="Search"
        onClick={() => setPaletteOpen(true)}
      >
        <Search className="size-4" aria-hidden="true" />
      </Button>

      <LiveStatusPill />

      <div className="[&_button]:text-chrome-foreground [&_button:hover]:bg-chrome-accent [&_button:hover]:text-chrome-foreground">
        <ThemeToggle />
      </div>
    </header>
  );
}
