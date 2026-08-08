import Link from "next/link";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { ShortcutOverlay } from "./shortcut-overlay";
import { GlobalNavShortcuts } from "./global-nav-shortcuts";
import { PageTitleProvider } from "./page-title-context";

/**
 * The app shell (docs/14-frontend-implementation-plan.md §F0): sidebar nav, topbar with
 * the demo-data indicator, page container, breadcrumb slot. Responsive per
 * docs/06-frontend.md §9 — full sidebar >=1024px (`lg`), a Sheet drawer below it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PageTitleProvider>
      <GlobalNavShortcuts />
      <CommandPalette />
      <ShortcutOverlay />
      <div className="flex min-h-svh w-full">
        <aside className="border-sidebar-border bg-sidebar sticky top-0 hidden h-svh w-56 shrink-0 border-r lg:flex lg:flex-col">
          <div className="border-sidebar-border flex h-12 shrink-0 items-center border-b px-4">
            <Link href="/" className="text-sidebar-foreground text-sm font-semibold tracking-tight">
              OpenSpec
            </Link>
          </div>
          <Sidebar className="flex-1 overflow-y-auto" />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main-content" className="bg-background min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </PageTitleProvider>
  );
}
