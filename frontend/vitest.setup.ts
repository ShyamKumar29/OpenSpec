import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia (used by prefers-reduced-motion checks and
// lib/hooks/use-media-query.ts). A minimal "nothing ever matches" polyfill is enough for
// component tests — they assert on rendered content, not real viewport/media behaviour.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom does not implement scrollIntoView either (used by DocumentViewer to bring the
// active evidence highlight into view).
if (typeof window !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
