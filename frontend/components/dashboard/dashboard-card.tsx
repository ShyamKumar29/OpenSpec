import type { LucideIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Uniform chrome for every dashboard tile — icon, title, and a visible requirement tag
 * (FR-DSH-*, QR-*, or a `01-requirements.md` section) so every number on this page traces
 * to a named requirement by construction (risk E4, "dashboard becomes vanity metrics",
 * docs/06-frontend.md §Risks). Carried over from the F0 shell's placeholder tiles
 * (`app/(shell)/page.tsx`), now wrapping real content instead of a "Computed in F6" stub.
 */
export function DashboardCard({
  icon: Icon,
  title,
  description,
  requirement,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  requirement: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card data-testid="dashboard-card" data-title={title} className={cn("gap-3 py-4", className)}>
      <CardHeader className="gap-1 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <CardTitle className="truncate text-sm">{title}</CardTitle>
          </div>
          <span className="metric text-muted-foreground shrink-0 text-[0.65rem]">
            {requirement}
          </span>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <div className="px-4">{children}</div>
    </Card>
  );
}
