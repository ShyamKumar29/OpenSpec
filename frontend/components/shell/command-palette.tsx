"use client";

import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useCommandPalette, useShortcut, useShortcutOverlay } from "@/lib/keyboard/registry";
import { NAV_ITEMS } from "./nav-items";

/** ⌘K everywhere (docs/14-frontend-implementation-plan.md §F0). Navigation now; F1+
 *  phases add record/task search results to the same palette without touching this shell. */
export function CommandPalette() {
  const router = useRouter();
  const { open, setOpen } = useCommandPalette();
  const { setOpen: setOverlayOpen } = useShortcutOverlay();

  useShortcut({
    keys: "mod+k",
    display: "⌘K",
    description: "Open command palette",
    scope: "Global",
    handler: () => setOpen(!open),
  });

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to a page or action"
    >
      <CommandInput placeholder="Jump to a page…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
              {item.goToKey ? (
                <CommandShortcut>G {item.goToKey.toUpperCase()}</CommandShortcut>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem
            value="Keyboard shortcuts"
            onSelect={() => {
              setOpen(false);
              setOverlayOpen(true);
            }}
          >
            Keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
