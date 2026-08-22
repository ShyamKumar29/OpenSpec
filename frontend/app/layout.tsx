import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { QueryProvider } from "@/lib/queries/provider";
import { ShortcutRegistryProvider } from "@/lib/keyboard/registry";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/**
 * The Industrial Precision type pairing (Stitch `industrial_precision/DESIGN.md`):
 * Hanken Grotesk carries structural hierarchy — headings, labels, nav — and JetBrains
 * Mono carries every piece of *data*. The split is functional, not decorative: monospaced
 * figures keep MPNs, confidences, and unit-bearing values aligned in a column, which is
 * what makes a dense table scannable. The CSS variable names are kept as `--font-geist-*`
 * deliberately — `app/globals.css` and a handful of components already reference them, and
 * renaming them would be churn with no visual effect.
 */
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "OpenSpec",
    template: "%s · OpenSpec",
  },
  description: "Verification-first product-data enrichment for industrial distribution.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${hankenGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <div className="bg-red-600 text-white text-center py-2 font-bold text-sm tracking-wider w-full uppercase">
          ⚠️ DEMO MODE / USING FIXTURE DATA (M3 Baseline Verified) - NO AI ASSERTION WITHOUT EVIDENCE ⚠️
        </div>
        <a
          href="#main-content"
          className="bg-foreground text-background sr-only rounded-md px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <QueryProvider>
            <ShortcutRegistryProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </ShortcutRegistryProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
