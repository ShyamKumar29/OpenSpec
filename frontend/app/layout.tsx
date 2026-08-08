import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { QueryProvider } from "@/lib/queries/provider";
import { ShortcutRegistryProvider } from "@/lib/keyboard/registry";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "OpenSpec",
    template: "%s · OpenSpec",
  },
  description: "Verification-first product-data enrichment for industrial distribution.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
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
