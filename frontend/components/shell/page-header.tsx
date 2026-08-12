import { cn } from "@/lib/utils";

/**
 * Page title block. The Stitch pages open every workspace the same way — a large Hanken
 * Grotesk display title, a monospaced one-line subtitle underneath, actions pinned right,
 * and a hairline closing the block off from the content. Keeping that in one component is
 * what stops nine routes from drifting into nine header treatments.
 *
 * `eyebrow` renders an optional small-caps kicker above the title (used where a page has
 * a parent context to name, e.g. a record's class or a document's manufacturer).
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-end justify-between gap-4 border-b px-4 py-5 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="label-caps text-muted-foreground mb-1.5">{eyebrow}</div> : null}
        <h1 className="text-foreground font-heading text-2xl leading-tight font-bold tracking-tight sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground metric mt-1 text-[0.8125rem] leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
