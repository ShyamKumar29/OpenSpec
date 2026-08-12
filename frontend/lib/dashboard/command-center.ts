/**
 * Pure model + geometry for the dashboard's command center
 * (`components/dashboard/command-center.tsx`). No DOM, no React, no fetching — the same
 * discipline CLAUDE.md asks of `domain/val` and `domain/nrm`, applied to the one piece of
 * the dashboard that would otherwise be untestable pixel-pushing.
 *
 * The environment itself is no longer generated: it is a static plate
 * (`public/dashboard/command-center.webp`), and this module's job is the *registration*
 * between that image and the live application state drawn over it. Two halves:
 *
 * - `buildChannels` — what the engine is emitting, derived from real catalog/review state.
 *   Every channel carries the page that owns its number. If a number can't be sourced from
 *   the existing queries, it does not get a flow.
 * - `PLATE` / `SLOT_HOTSPOT` / `FREE_ANCHORS` / `layoutOverlay` — where each of those lands
 *   *in the scene*, in the plate's own pixels, so a landing can be read straight off the
 *   image and the SVG drawn over it agrees with the picture.
 * - `FRAME_SLOTS` — where each instrument and callout card sits *on screen*, in percentages
 *   of the hero box. See the note above `PLATE` for why those are two different things.
 */
import type { CatalogHealth } from "@/lib/contracts/eval";
import type { ReviewReasonCode } from "@/lib/contracts/review";
import { REVIEW_REASON_LABEL } from "@/lib/format/review-reason";

/** Severity of a channel. Never rendered as colour alone — every node also carries its
 *  label, its count, and an icon (NFR-ACC-3). */
export type ChannelTone = "healthy" | "attention" | "critical" | "idle";

export interface CommandChannel {
  id: string;
  /** Short label rendered on the node chip. */
  label: string;
  /** The magnitude this channel carries — a real count, never a scaled invention. */
  value: number;
  /** One line explaining what the number is, shown on hover/focus and to screen readers. */
  detail: string;
  tone: ChannelTone;
  /** The page that owns this data. Every node is a link; the dashboard is a jumping-off
   *  point, not a dead end. */
  href: string;
}

export interface PositionedChannel extends CommandChannel {
  /** Where the flow lands, in plate pixels. */
  x: number;
  y: number;
  /** Where it leaves the engine, in plate pixels. */
  originX: number;
  originY: number;
  /** Bearing of the flow, SVG convention. Lets the renderer orient things along it
   *  (chevrons, packet direction) without re-deriving the trigonometry. */
  angleDeg: number;
  /** 0..1, this channel's share of the largest channel. Drives flow thickness and node
   *  emphasis, so a 3-item queue does not shout as loudly as a 300-item one. */
  intensity: number;
}

/** Review reason codes ordered most- to least-severe. Mirrors the queue-tab order in
 *  docs/06-frontend.md §3.3. */
const REASON_TONE: Record<ReviewReasonCode, ChannelTone> = {
  VERIFICATION_FAILED: "critical",
  CONFLICTING: "critical",
  TIER0_APPROVAL: "attention",
  BELOW_THRESHOLD: "attention",
  NO_DOCUMENT: "attention",
  AMBIGUOUS: "attention",
};

const REASON_DETAIL: Record<ReviewReasonCode, string> = {
  VERIFICATION_FAILED: "Independent verifier did not entail the proposed span (INV-2).",
  BELOW_THRESHOLD: "Composite confidence under the auto-accept threshold.",
  TIER0_APPROVAL: "Pressure, temperature, class & compliance — never auto-accepted (INV-9).",
  NO_DOCUMENT: "No source document bound, so nothing can be extracted from evidence.",
  AMBIGUOUS: "Several candidate spans matched; a human picks the authoritative one.",
  CONFLICTING: "Two sources disagree — resolved by a reviewer, never by averaging.",
};

export interface ChannelInputs {
  catalogHealth: CatalogHealth | undefined;
  reviewCounts: { counts: Record<ReviewReasonCode, number>; totalOpen: number } | undefined;
}

/**
 * Derives the channel set from live application state.
 *
 * One healthy outbound flow (values that cleared every gate and are commerce-ready), the
 * six review reason codes as work leaving the engine towards a human, and the largest
 * `Unknown` hotspot. Channels with a zero count are kept rather than dropped — "zero
 * verification failures" is itself operational information, and dropping them would make
 * the composition's shape jump around between refetches.
 */
export function buildChannels({ catalogHealth, reviewCounts }: ChannelInputs): CommandChannel[] {
  const channels: CommandChannel[] = [];

  if (catalogHealth) {
    // Records whose mandatory attributes all cleared the pipeline without a human —
    // the straight-through share of the catalog, expressed as records rather than a
    // percentage so it is directly comparable with the review counts beside it.
    const autoAccepted = Math.round(
      catalogHealth.stpAutoEligibleOnly.value * catalogHealth.totalRecords,
    );
    channels.push({
      id: "auto-accepted",
      label: "Commerce-ready",
      value: autoAccepted,
      detail: `Records straight-through on every auto-eligible attribute — ${Math.round(
        catalogHealth.stpAutoEligibleOnly.value * 100,
      )}% of ${catalogHealth.totalRecords}.`,
      tone: "healthy",
      href: "/catalog?status=ACCEPTED",
    });
  }

  if (reviewCounts) {
    for (const code of Object.keys(REASON_TONE) as ReviewReasonCode[]) {
      channels.push({
        id: `review-${code}`,
        label: REVIEW_REASON_LABEL[code],
        value: reviewCounts.counts[code] ?? 0,
        detail: REASON_DETAIL[code],
        tone: REASON_TONE[code],
        href: `/review?reason_code=${code}`,
      });
    }
  }

  if (catalogHealth && catalogHealth.unknownReasonBreakdown.length > 0) {
    const top = [...catalogHealth.unknownReasonBreakdown].sort((a, b) => b.count - a.count)[0];
    channels.push({
      id: "unknown-hotspot",
      label: "Unknown hotspot",
      value: top.count,
      detail: `${top.reason.replaceAll("_", " ").toLowerCase()} — routed to ${top.fixOwner}.`,
      tone: "attention",
      href: "/catalog?has_unknown=true",
    });
  }

  return channels;
}

/* ---------------------------------------------------------------------------
   Two coordinate systems, and why there have to be two.

   `public/dashboard/command-center-city.webp` is the environment — an industrial site seen
   from the air, the enrichment tower at its centre, the districts of the catalog around it.
   It is drawn *cover*: it fills the hero at every desktop shape, and whatever does not fit
   is crop.

   That makes the plate's own pixels the right coordinate system for anything that has to
   land on a *place in the scene* — the tower, the operational deck, the point a ray stops
   at — and the wrong one for anything that has to stay on screen, because a hero shaped
   differently from the plate crops the plate's edges away and takes any panel parked on
   them with it. That is exactly how the run/system overview came to be sliced off under the
   topbar at short desktop windows.

   So the module keeps them apart:

   - **Scene space** — `PLATE`, `SLOT_HOTSPOT`, `FREE_ANCHORS`, and the SVG's viewBox.
     Plate pixels. Tracks the picture, and may be cropped at the frame's edges, which is
     why nothing here is placed near one.
   - **Frame space** — `FRAME_SLOTS`. Percentages of the hero box itself. Every instrument
     and every callout card lives here, so no card can be cropped at any hero shape, and the
     composition uses the hero's whole width rather than only the part of it the plate's
     aspect ratio happens to cover.

   The two are tied together by the tower. It sits at 49.1% / 59.8% of the plate, and
   because `cover` crops one axis at a time and always about the centre, it lands within
   about a percent of that in frame space across every hero this layout meets (asserted in
   the test file). That is what lets a ray drawn in scene space and a card placed in frame
   space still read as one picture — and it is why a card is joined to its ray by its own
   CSS leader tail rather than by a line drawn between the two systems, which would drift
   the moment the hero changed shape.
   --------------------------------------------------------------------------- */

/**
 * Width of the atmospheric margin carried on each side of the composition, in plate pixels.
 *
 * Desktop hero boxes run 2.1-2.8 in aspect; the composition itself is 1.849, so fitting it
 * inside the hero left between 13% and 34% of the width as empty margin. The plate instead
 * carries that margin as environment and the stage *covers* the hero, which fills the width
 * at every desktop size — there is simply city where there used to be nothing.
 */
export const PLATE_MARGIN = 308;

export const PLATE = {
  width: 1324 + PLATE_MARGIN * 2,
  height: 716,
  /** Where the flows converge on the tower — the lit band across the lattice, and the
   *  origin every overlay flow is drawn from. Measured off the plate. */
  burstX: 645 + PLATE_MARGIN,
  burstY: 428,
  /** The lit operational deck at the tower's foot. The live sweep and the engine pulse are
   *  registered to this ellipse, not to the burst, because that is the part of the plate
   *  that reads as ground. Measured off the outer ring of the deck. */
  plazaX: 642 + PLATE_MARGIN,
  plazaY: 526,
  plazaRx: 96,
  plazaRy: 46,
} as const;

/** A rectangle in frame space: percentages of the hero box, `0`-`100`. */
export interface FrameRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type SlotId =
  | "overview"
  | "legend"
  | "status"
  | "doc-binding"
  | "active-run"
  | "unknown"
  | "healthy"
  | "tier0"
  | "validation"
  | "review"
  | "engine";

/**
 * Where each instrument and callout sits in the hero, as percentages of it.
 *
 * The arrangement is a command center rather than a grid, and deliberately asymmetric: the
 * left column carries the run itself and the work that came out healthy, the right carries
 * what needs a human, the top band carries the state summary and the key, the floor carries
 * the quality signals, and the middle is left to the tower — nothing overlaps the mast, the
 * deck or another card at any hero shape.
 */
export const FRAME_SLOTS: Record<SlotId, FrameRect> = {
  // Left — the run, and what came out of it clean.
  overview: { x0: 1.2, y0: 2.5, x1: 17.2, y1: 62 },
  healthy: { x0: 1.2, y0: 68, x1: 15.7, y1: 89 },
  // Upper band — the key, the engine's own state, the run in flight.
  legend: { x0: 19.5, y0: 2.5, x1: 40.5, y1: 11 },
  "active-run": { x0: 42, y0: 4.5, x1: 58, y1: 26 },
  status: { x0: 65.5, y0: 2.5, x1: 98.8, y1: 14.5 },
  // Left of centre — the review signal that is about missing inputs rather than bad output.
  "doc-binding": { x0: 19.5, y0: 19, x1: 33.5, y1: 40 },
  // Right — everything waiting on a human, worst at the top.
  unknown: { x0: 76, y0: 21, x1: 90.5, y1: 42 },
  tier0: { x0: 84.5, y0: 47, x1: 98.8, y1: 68 },
  review: { x0: 69.5, y0: 74, x1: 84, y1: 95 },
  // Floor — quality, and the engine readout under the deck.
  validation: { x0: 23.5, y0: 71, x1: 38, y1: 92 },
  engine: { x0: 41, y0: 86.5, x1: 59, y1: 95.5 },
};

/**
 * A slot as CSS custom properties.
 *
 * Custom properties rather than `left`/`top`/`width` directly, because the same element is
 * a stacked card below `lg` and a positioned annotation above it: an inline `width` would
 * squeeze the stacked card too, whereas a variable is only read by the `lg:` utilities that
 * consume it.
 */
export function slotVars(slot: SlotId): Record<`--slot-${string}`, string> {
  const r = FRAME_SLOTS[slot];
  const pct = (v: number) => `${v.toFixed(3)}%`;
  return {
    "--slot-l": pct(r.x0),
    "--slot-t": pct(r.y0),
    "--slot-w": pct(r.x1 - r.x0),
    // A floor, not a fixed height: real values must never be clipped to preserve a
    // composition, so a panel that needs more room grows downwards into the city.
    "--slot-h": pct(r.y1 - r.y0),
  };
}

/**
 * Where the flow feeding a given card lands, in plate pixels.
 *
 * Each is a patch of open city between the engine and the card that reports it, so the ray
 * visibly travels *towards* the panel and stops at a marked hotspot short of it rather than
 * disappearing behind it — the card's own leader tail covers the last stretch. Measured off
 * the plate, and chosen well inside the frame so that the crop at a wide hero never reaches
 * one.
 */
export const SLOT_HOTSPOT: Partial<Record<SlotId, { x: number; y: number }>> = {
  healthy: { x: 504, y: 544 },
  validation: { x: 815, y: 573 },
  "doc-binding": { x: 776, y: 315 },
  unknown: { x: 1397, y: 322 },
  tier0: { x: 1428, y: 430 },
  review: { x: 1214, y: 573 },
};

export function slotHotspot(slot: SlotId): { x: number; y: number } {
  const measured = SLOT_HOTSPOT[slot];
  if (measured) return measured;
  // A slot the composition has not been tuned a landing for — aim two thirds of the way
  // from the engine towards where the card sits, reading its frame rectangle as if it were
  // plate space. Approximate by construction, and only ever reached if a future callout is
  // wired to a channel before its hotspot is measured.
  const r = FRAME_SLOTS[slot];
  const cx = ((r.x0 + r.x1) / 200) * PLATE.width;
  const cy = ((r.y0 + r.y1) / 200) * PLATE.height;
  return {
    x: PLATE.burstX + (cx - PLATE.burstX) * 0.66,
    y: PLATE.burstY + (cy - PLATE.burstY) * 0.66,
  };
}

/**
 * Landing points for channels the dashboard has not given a callout card.
 *
 * Each is a stretch of open city clear of every frame slot and every measured hotspot, so
 * the marker chip that labels the ray covers buildings rather than another instrument. In
 * channel order, and deterministic: a refetch that changes only counts never reshuffles the
 * composition under the reader's eyes.
 */
export const FREE_ANCHORS: readonly { x: number; y: number }[] = [
  { x: 660, y: 400 },
  { x: 1180, y: 572 },
  { x: 1230, y: 250 },
  { x: 620, y: 598 },
  { x: 830, y: 250 },
  { x: 1330, y: 598 },
];

/**
 * Places every channel on the plate.
 *
 * `anchors` is what the view has already decided: a channel reported by a callout card
 * lands on that card's own hotspot. Anything left over takes the next free stretch of city,
 * in channel order — deterministic, so a refetch that changes only counts never reshuffles
 * the composition under the reader's eyes.
 */
export function layoutOverlay(
  channels: CommandChannel[],
  anchors: Record<string, { x: number; y: number }> = {},
): PositionedChannel[] {
  const maxValue = Math.max(...channels.map((c) => c.value), 1);
  let free = 0;

  return channels.map((channel) => {
    const anchor = anchors[channel.id] ?? FREE_ANCHORS[free++ % FREE_ANCHORS.length];
    const dx = anchor.x - PLATE.burstX;
    const dy = anchor.y - PLATE.burstY;
    const len = Math.hypot(dx, dy) || 1;
    // The flow starts clear of the burst itself, so the plate's own light stays the
    // brightest thing in the frame and the overlay reads as leaving it.
    const start = Math.min(46, len * 0.35);

    return {
      ...channel,
      x: anchor.x,
      y: anchor.y,
      originX: PLATE.burstX + (dx / len) * start,
      originY: PLATE.burstY + (dy / len) * start,
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
      intensity: channel.value <= 0 ? 0 : Math.max(0.12, channel.value / maxValue),
    };
  });
}

/**
 * Midpoint completeness of a histogram bucket label — `"51-75%"` → `0.63`.
 *
 * The bucket labels come from the API (`GET /metrics/catalog-health`) as display strings,
 * so this parses rather than assumes. If a label ever stops being parseable the bucket
 * falls back to its ordinal position in the distribution, which keeps the ordering correct
 * even if the exact value is approximate.
 */
export function bucketCompleteness(bucket: string, index: number, total: number): number {
  const nums = bucket.match(/\d+(?:\.\d+)?/g);
  if (nums && nums.length >= 2) return (Number(nums[0]) + Number(nums[1])) / 200;
  if (nums && nums.length === 1) return Number(nums[0]) / 100;
  return total <= 1 ? 0.5 : index / (total - 1);
}

/* ---------------------------------------------------------------------------
   Flow geometry. Two tiny pure helpers, here rather than inline in the renderer for the
   same reason everything else in this file is: they are trigonometry, they are exactly the
   kind of thing that is wrong by a sign for months, and they are trivial to test.
   --------------------------------------------------------------------------- */

/**
 * A flow as a tapered quad rather than a constant-width stroke.
 *
 * Perspective: a channel leaving the engine is narrow at the core and spreads as it travels
 * out across the ground plane, which is what lets the overlay sit on the plate's own light
 * instead of looking like a wire laid over a photograph.
 */
export function taperedBeamPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  startWidth: number,
  endWidth: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  // A zero-length flow has no direction to be perpendicular to; emit nothing rather than
  // NaNs, which SVG renders as an invisible-but-console-noisy broken path.
  if (len === 0) return "";
  const nx = -dy / len;
  const ny = dx / len;
  const h1 = startWidth / 2;
  const h2 = endWidth / 2;
  return (
    `M${round(x1 + nx * h1)} ${round(y1 + ny * h1)}` +
    `L${round(x2 + nx * h2)} ${round(y2 + ny * h2)}` +
    `L${round(x2 - nx * h2)} ${round(y2 - ny * h2)}` +
    `L${round(x1 - nx * h1)} ${round(y1 - ny * h1)}Z`
  );
}

/**
 * The outward-pointing chevron stack that marks where a flow lands — the reference
 * composition's "this is a destination, not a place the ray faded out" glyph. Returned in
 * local coordinates around the origin, pointing east; the caller rotates it onto the
 * flow's bearing with a transform.
 */
export function chevronMarkPath(size: number, count = 2, gap = 0.85): string {
  return Array.from({ length: count }, (_, i) => {
    const x = i * size * gap;
    return `M${round(x - size * 0.5)} ${round(-size * 0.62)}L${round(x + size * 0.28)} 0L${round(x - size * 0.5)} ${round(size * 0.62)}`;
  }).join("");
}

/** Whole plate pixels. Sub-pixel coordinates are well under a device pixel at this scale,
 *  so the precision buys nothing and the bytes cost real transfer time. */
function round(n: number): string {
  return Math.round(n).toString();
}
