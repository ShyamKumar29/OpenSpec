"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { useCurrentPageTitle } from "./page-title-context";

const SEGMENT_LABELS: Record<string, string> = {
  catalog: "Catalog",
  review: "Review",
  documents: "Documents",
  evaluation: "Evaluation",
  judge: "Judge Mode",
  runs: "Runs",
  settings: "Settings",
  import: "Import",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const dynamicTitle = useCurrentPageTitle();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    const home = NAV_ITEMS.find((i) => i.href === "/")!;
    return (
      <ol className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <li className="text-foreground font-medium">{home.label}</li>
      </ol>
    );
  }

  const crumbs = segments.map((segment, i) => {
    const href = `/${segments.slice(0, i + 1).join("/")}`;
    const isLast = i === segments.length - 1;
    const label =
      isLast && dynamicTitle
        ? dynamicTitle
        : (SEGMENT_LABELS[segment] ?? decodeURIComponent(segment));
    return { href, label, isLast };
  });

  return (
    <ol className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
      <li className="shrink-0">
        <Link href="/" className="hover:text-foreground">
          Dashboard
        </Link>
      </li>
      {crumbs.map((c) => (
        <li key={c.href} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          {c.isLast ? (
            <span className="text-foreground truncate font-medium" aria-current="page">
              {c.label}
            </span>
          ) : (
            <Link href={c.href} className="hover:text-foreground truncate">
              {c.label}
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}
