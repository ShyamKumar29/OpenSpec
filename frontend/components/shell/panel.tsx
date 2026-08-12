import { cn } from "@/lib/utils";

/**
 * The one container primitive of the Industrial Precision surface language (Stitch
 * `industrial_precision/DESIGN.md` §Elevation & Depth, §Shapes): a flat surface, a 1px
 * structural border, sharp corners, and *no* drop shadow — depth is conveyed by tiering
 * a lighter surface against the parchment ground, not by blur.
 *
 * This exists so panels across the dashboard, catalog, review queue, evaluation, and
 * document pages share one definition instead of nine hand-tuned `border bg-card`
 * strings. `components/ui/card.tsx` (shadcn) stays exactly as it is and is still used
 * wherever a Card's slot structure is wanted; `Panel` is for the far more common case of
 * "a bordered region with a small-caps title".
 *
 * `tone="chrome"` is the inverse variant used for the near-black surfaces that read as
 * "bolted-on hardware" (the dashboard's floating overlay callouts, terminal-style logs).
 */
export function Panel({
  children,
  className,
  tone = "surface",
  as: As = "div",
  ...props
}: React.ComponentProps<"div"> & {
  tone?: "surface" | "chrome" | "sunken";
  /** Promote the panel to a landmark element where the page structure calls for one
   *  (e.g. a filter rail is an `aside`). Defaults to a plain `div`. */
  as?: "div" | "aside" | "section";
}) {
  return (
    <As
      data-slot="panel"
      data-tone={tone}
      className={cn(
        "rounded-sm border",
        tone === "surface" && "border-border bg-card text-card-foreground",
        tone === "chrome" && "border-chrome-border bg-chrome text-chrome-foreground",
        tone === "sunken" && "border-border bg-muted/60 text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </As>
  );
}

/**
 * A panel's header strip. Renders the title as a small-caps metadata label rather than a
 * sentence-case heading, which is what visually separates "chrome" from "data" throughout
 * the design. `as` lets a caller promote it to a real heading element where the document
 * outline needs one — the default `div` avoids injecting stray headings into pages that
 * already have a correct h1→h2 structure (axe `heading-order`).
 */
export function PanelHeader({
  title,
  actions,
  as: As = "div",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  actions?: React.ReactNode;
  as?: "div" | "h2" | "h3";
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        "border-border flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2",
        className,
      )}
      {...props}
    >
      <As className="label-caps text-foreground/80 min-w-0 truncate">{title}</As>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      {children}
    </div>
  );
}

/** Body padding for a `Panel`. Tight by default — density is a stated goal, not an
 *  accident (DESIGN.md §Layout & Spacing: "padding is intentionally tight"). */
export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="panel-body" className={cn("p-3", className)} {...props} />;
}

/** A free-standing small-caps label for groups that don't warrant a whole panel. */
export function SectionLabel({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("label-caps text-muted-foreground", className)} {...props} />;
}
