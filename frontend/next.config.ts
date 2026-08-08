import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright drives the dev server against 127.0.0.1 (playwright.config.ts) rather
  // than localhost — without this, HMR/static-chunk requests are cross-origin blocked.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
