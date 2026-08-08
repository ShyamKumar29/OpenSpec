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
  icon: LucideIcon;
  /** Single-letter "go to" shortcut, registered under the `g` chord (see lib/keyboard). */
  goToKey?: string;
}

/** Top-level navigation (docs/06-frontend.md §2). `/runs/:id` and `/catalog/:id` etc.
 *  are reached by link, not from the sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, goToKey: "d" },
  { href: "/catalog", label: "Catalog", icon: Package, goToKey: "c" },
  { href: "/review", label: "Review", icon: ClipboardCheck, goToKey: "r" },
  { href: "/documents", label: "Documents", icon: FileText, goToKey: "o" },
  { href: "/evaluation", label: "Evaluation", icon: LineChart, goToKey: "e" },
  { href: "/judge", label: "Judge Mode", icon: Sparkles, goToKey: "j" },
  { href: "/import", label: "Import", icon: Upload, goToKey: "i" },
  { href: "/settings", label: "Settings", icon: Settings, goToKey: "s" },
];
