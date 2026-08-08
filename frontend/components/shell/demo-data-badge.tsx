import { isMockApiMode } from "@/lib/api/mode";
import { cn } from "@/lib/utils";

/**
 * Non-removable while the mock adapter is active (docs/14-frontend-implementation-plan.md
 * §C2, risk F-5: "Mock metrics presented as real"). Driven by API mode, not a
 * component-local flag — disappears by construction the day `NEXT_PUBLIC_API_BASE_URL`
 * points at a real backend.
 */
export function DemoDataBadge({ className }: { className?: string }) {
  if (!isMockApiMode()) return null;
  return (
    <span
      className={cn(
        "border-status-needs-review/40 bg-status-needs-review-bg text-status-needs-review inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold tracking-wide uppercase",
        className,
      )}
      title="This app is running against generated fixture data, not a live backend."
    >
      <span aria-hidden="true">●</span> Demo data — no backend connected
    </span>
  );
}
