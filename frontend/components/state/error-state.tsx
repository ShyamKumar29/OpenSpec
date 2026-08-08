import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

/** RFC 9457-aware error display — the single place an API error's `title`/`detail`/
 *  `code`/`correlation_id` are rendered, so a support request is always answerable
 *  ("what was the correlation id?") without digging into devtools. */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const problem = error instanceof ApiError ? error.problem : null;

  return (
    <div
      className={cn(
        "border-status-rejected/30 bg-status-rejected-bg flex flex-col items-center justify-center gap-2 rounded-lg border px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="text-status-rejected size-8" aria-hidden="true" />
      <p className="text-foreground text-sm font-medium">
        {problem?.title ?? "Something went wrong"}
      </p>
      <p className="text-muted-foreground max-w-sm text-sm">
        {problem?.detail ??
          (error instanceof Error ? error.message : "An unexpected error occurred.")}
      </p>
      {problem ? (
        <p className="metric text-muted-foreground/70 text-xs">
          {problem.code} · correlation id {problem.correlationId}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          Retry
        </Button>
      ) : null}
    </div>
  );
}
