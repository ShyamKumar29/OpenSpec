import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  FileText,
  LineChart,
  Sparkles,
  Settings,
  Upload,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** The caption under the icon in the narrow desktop rail. Short enough not to wrap at
   *  5rem, but still a real accessible name — never a tooltip-only label (NFR-ACC-2). */
  railLabel: string;
  icon: LucideIcon;
  /** Single-letter "go to" shortcut, registered under the `g` chord (see lib/keyboard). */
  goToKey?: string;
}

/** Top-level navigation (docs/06-frontend.md §2). `/runs/:id` and `/catalog/:id` etc.
 *  are reached by link, not from the sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", railLabel: "Dash", icon: LayoutDashboard, goToKey: "d" },
  { href: "/catalog", label: "Catalog", railLabel: "Catalog", icon: Package, goToKey: "c" },
  { href: "/review", label: "Review", railLabel: "Review", icon: ClipboardCheck, goToKey: "r" },
  { href: "/documents", label: "Documents", railLabel: "Docs", icon: FileText, goToKey: "o" },
  { href: "/evaluation", label: "Evaluation", railLabel: "Eval", icon: LineChart, goToKey: "e" },
  { href: "/judge", label: "Judge Mode", railLabel: "Judge", icon: Sparkles, goToKey: "j" },
  { href: "/import", label: "Import", railLabel: "Import", icon: Upload, goToKey: "i" },
  { href: "/settings", label: "Settings", railLabel: "Config", icon: Settings, goToKey: "s" },
];
