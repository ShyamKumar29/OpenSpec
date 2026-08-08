import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Generic row-of-skeletons block. Compose from this rather than inventing a bespoke
 *  loading state per page (docs/14-frontend-implementation-plan.md §F0). */
export function LoadingBlock({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function LoadingTable({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading table">
      <Skeleton className="h-8 w-1/3" />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: columns }).map((__, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div
      className="border-border flex flex-col gap-3 rounded-lg border p-4"
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}
