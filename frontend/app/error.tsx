"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/state/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured, no document content or secrets — just enough to correlate a report.
    console.error("[app] unhandled error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <ErrorState error={error} onRetry={reset} className="max-w-md" />
    </div>
  );
}
