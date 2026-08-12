import Link from "next/link";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Breadcrumb } from "./breadcrumb";
import { CommandPalette } from "./command-palette";
import { ShortcutOverlay } from "./shortcut-overlay";
import { GlobalNavShortcuts } from "./global-nav-shortcuts";
import { DemoDataBadge } from "./demo-data-badge";
import { PageTitleProvider } from "./page-title-context";

/**
 * The app shell (docs/14-frontend-implementation-plan.md §F0), redesigned to the Stitch
 * "Industrial Command Center" chrome: a narrow near-black icon rail bolted to the left
 * edge and a near-black topbar across the top, framing a warm parchment workspace.
 *
 * Structure and behaviour are unchanged from the original shell — same nav model, same
 * command palette, same shortcut overlay, same responsive contract (full rail ≥1024px
 * `lg`, Sheet drawer below it, per docs/06-frontend.md §9). What changed is the rail's
 * width and fill, and that the breadcrumb now lives on its own workspace strip below the
 * chrome rather than inside it, which is where the Stitch pages put it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PageTitleProvider>
      <GlobalNavShortcuts />
      <CommandPalette />
      <ShortcutOverlay />
      <div className="flex min-h-svh w-full">
        <aside className="border-sidebar-border bg-sidebar sticky top-0 hidden h-svh w-20 shrink-0 flex-col border-r lg:flex">
          <Link
            href="/"
            aria-label="OpenSpec — dashboard"
            className="border-sidebar-border text-sidebar-foreground focus-visible:ring-sidebar-ring flex h-14 shrink-0 items-center justify-center border-b text-sm font-black tracking-tighter focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
          >
            {/* The rail is 5rem wide; the full wordmark lives in the topbar. */}
            <span aria-hidden="true">OS</span>
          </Link>
          <Sidebar variant="rail" className="flex-1 overflow-y-auto" />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <div className="border-border bg-background flex h-9 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <Breadcrumb />
            </div>
            <DemoDataBadge className="hidden shrink-0 sm:inline-flex" />
          </div>
          <main id="main-content" className="bg-background min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </PageTitleProvider>
  );
}
