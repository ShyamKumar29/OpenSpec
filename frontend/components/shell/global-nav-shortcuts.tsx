"use client";

import { useRouter } from "next/navigation";
import { useChordShortcut } from "@/lib/keyboard/registry";
import { NAV_ITEMS } from "./nav-items";

/** Registers the "G then <letter>" navigation chord once, globally — every page gets
 *  it for free without re-registering per route. */
export function GlobalNavShortcuts() {
  const router = useRouter();
  const followers = Object.fromEntries(
    NAV_ITEMS.filter((i) => i.goToKey).map((i) => [i.goToKey as string, i.label]),
  );

  useChordShortcut({
    leader: "g",
    followers,
    description: "Go to…",
    display: "G then <letter>",
    scope: "Global",
    onChord: (key) => {
      const item = NAV_ITEMS.find((i) => i.goToKey === key);
      if (item) router.push(item.href);
    },
  });

  return null;
}
