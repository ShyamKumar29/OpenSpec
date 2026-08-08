"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useShortcut, useShortcutOverlay } from "@/lib/keyboard/registry";

/** The `?` overlay — "20 minutes of work and it makes the demo look like a mature
 *  tool" (docs/06-frontend.md Recommendation 4). Lists every currently-registered
 *  binding, grouped by scope, so it always reflects what the current page actually
 *  supports rather than a hand-maintained list. */
export function ShortcutOverlay() {
  const { open, setOpen, bindings, chords } = useShortcutOverlay();

  useShortcut({
    keys: "shift+?",
    display: "?",
    description: "Show keyboard shortcuts",
    scope: "Global",
    handler: () => setOpen(true),
  });

  const scopes = Array.from(
    new Set([...bindings.map((b) => b.scope), ...chords.map((c) => c.scope)]),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Every action on this page is reachable without a mouse.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {scopes.map((scope) => (
            <div key={scope}>
              <h3 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
                {scope}
              </h3>
              <dl className="flex flex-col gap-1">
                {bindings
                  .filter((b) => b.scope === scope)
                  .map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-4 text-sm">
                      <dt className="text-foreground">{b.description}</dt>
                      <dd>
                        <kbd className="metric border-border bg-muted rounded border px-1.5 py-0.5 text-xs">
                          {b.display}
                        </kbd>
                      </dd>
                    </div>
                  ))}
                {chords
                  .filter((c) => c.scope === scope)
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-4 text-sm">
                      <dt className="text-foreground">{c.description}</dt>
                      <dd>
                        <kbd className="metric border-border bg-muted rounded border px-1.5 py-0.5 text-xs">
                          {c.display}
                        </kbd>
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
