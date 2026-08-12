"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Primary navigation.
 *
 * `variant="rail"` is the desktop presentation from the Stitch export: a narrow
 * near-black icon rail bolted to the left edge, each destination a stacked
 * icon + small-caps caption, the active one marked by a full-height inset bar.
 * `variant="list"` keeps the original horizontal list and is what the mobile Sheet
 * renders — a 5rem rail inside a drawer would be pointless.
 *
 * Both variants keep the behaviour the shell has always had: `aria-current="page"` on the
 * active item, visible focus rings, an accessible name on every link (the caption is real
 * text, not a tooltip), and `onNavigate` so the drawer can close itself.
 */
export function Sidebar({
  className,
  onNavigate,
  variant = "list",
}: {
  className?: string;
  onNavigate?: () => void;
  variant?: "list" | "rail";
}) {
  const pathname = usePathname();

  if (variant === "rail") {
    return (
      <nav
        className={cn("flex flex-col items-stretch gap-0.5 py-2", className)}
        aria-label="Primary"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-1 px-1 py-2.5 text-center transition-colors",
                "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {/* The active marker is a structural bar, not a colour change alone. */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 left-0 w-0.5",
                  active ? "bg-sidebar-primary" : "bg-transparent",
                )}
              />
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              <span className="label-caps w-full truncate text-[9px] leading-3 tracking-[0.08em]">
                {item.railLabel}
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className={cn("flex flex-col gap-0.5 p-2", className)} aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm font-medium transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-accent text-accent-foreground"
                : "text-foreground/80 hover:bg-accent/60 hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
