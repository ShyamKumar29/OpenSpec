import { describe, expect, it } from "vitest";
import {
  FRAME_SLOTS,
  FREE_ANCHORS,
  PLATE,
  SLOT_HOTSPOT,
  bucketCompleteness,
  buildChannels,
  chevronMarkPath,
  layoutOverlay,
  slotHotspot,
  slotVars,
  taperedBeamPath,
} from "./command-center";
import type { SlotId } from "./command-center";
import type { CatalogHealth } from "@/lib/contracts/eval";
import type { ReviewReasonCode } from "@/lib/contracts/review";

const metric = (value: number) => ({
  metricCode: "stp",
  slice: "all",
  value,
  ciLow: value,
  ciHigh: value,
  n: 100,
  isReal: true,
});

const catalogHealth: CatalogHealth = {
  totalRecords: 240,
  completenessDistribution: [
    { bucket: "0-25%", count: 10 },
    { bucket: "26-50%", count: 40 },
    { bucket: "51-75%", count: 90 },
    { bucket: "76-100%", count: 100 },
  ],
  stpAllMandatory: metric(0.58),
  stpAutoEligibleOnly: metric(0.5),
  unknownReasonBreakdown: [
    { reason: "ATTRIBUTE_NOT_IN_DOCUMENT", count: 12, fixOwner: "Ops" },
    { reason: "NO_DOCUMENT_FOUND", count: 41, fixOwner: "Ops (sourcing)" },
  ],
};

const counts: Record<ReviewReasonCode, number> = {
  VERIFICATION_FAILED: 88,
  BELOW_THRESHOLD: 141,
  TIER0_APPROVAL: 96,
  NO_DOCUMENT: 51,
  AMBIGUOUS: 24,
  CONFLICTING: 0,
};

describe("buildChannels", () => {
  it("derives every flow from real state — one healthy flow, six reason codes, one Unknown hotspot", () => {
    const channels = buildChannels({
      catalogHealth,
      reviewCounts: { counts, totalOpen: 400 },
    });

    expect(channels.map((c) => c.id)).toEqual([
      "auto-accepted",
      "review-VERIFICATION_FAILED",
      "review-CONFLICTING",
      "review-TIER0_APPROVAL",
      "review-BELOW_THRESHOLD",
      "review-NO_DOCUMENT",
      "review-AMBIGUOUS",
      "unknown-hotspot",
    ]);
  });

  it("computes the commerce-ready flow from STP × total records, not a decorative constant", () => {
    const channels = buildChannels({ catalogHealth, reviewCounts: undefined });
    expect(channels[0]).toMatchObject({ id: "auto-accepted", value: 120, tone: "healthy" });
  });

  it("picks the *largest* Unknown reason as the hotspot, not the first one listed", () => {
    const channels = buildChannels({ catalogHealth, reviewCounts: undefined });
    const hotspot = channels.find((c) => c.id === "unknown-hotspot");
    expect(hotspot?.value).toBe(41);
    expect(hotspot?.detail).toContain("Ops (sourcing)");
  });

  it("keeps zero-count channels rather than dropping them — 'zero failures' is information, and the composition must not reshape between refetches", () => {
    const channels = buildChannels({ catalogHealth, reviewCounts: { counts, totalOpen: 400 } });
    const conflicting = channels.find((c) => c.id === "review-CONFLICTING");
    expect(conflicting).toBeDefined();
    expect(conflicting?.value).toBe(0);
  });

  it("renders nothing at all rather than placeholder flows while data is still loading", () => {
    expect(buildChannels({ catalogHealth: undefined, reviewCounts: undefined })).toEqual([]);
  });

  it("routes every channel to the page that owns its data", () => {
    const channels = buildChannels({ catalogHealth, reviewCounts: { counts, totalOpen: 400 } });
    for (const channel of channels) {
      expect(channel.href).toMatch(/^\/(catalog|review)/);
    }
  });
});

/**
 * Hero boxes measured off the running dashboard at the widths docs/06-frontend.md §9 calls
 * out, plus the extremes this layout actually meets: a short 1366x768 laptop, a 1920 window
 * that is not full height (the shape that used to clip the run overview under the topbar),
 * and a 2560x1440 desktop. Aspects run 2.13-3.10.
 */
const HEROES: [string, number, number][] = [
  ["1280x800", 1168, 496],
  ["1366x768", 1254, 464],
  ["1440x900", 1328, 596],
  ["1600x900", 1488, 596],
  ["1920x1080", 1808, 790],
  ["1920x940", 1808, 650],
  ["1920x880", 1808, 590],
  ["2560x1440", 2448, 1150],
];

/** A point in plate pixels, as a percentage of the hero the plate is drawn `cover` into. */
function toFrame(p: { x: number; y: number }, hw: number, hh: number) {
  const s = Math.max(hw / PLATE.width, hh / PLATE.height);
  return {
    x: ((p.x * s - (PLATE.width * s - hw) / 2) / hw) * 100,
    y: ((p.y * s - (PLATE.height * s - hh) / 2) / hh) * 100,
  };
}

const overlaps = (a: (typeof FRAME_SLOTS)[SlotId], b: (typeof FRAME_SLOTS)[SlotId]) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe("FRAME_SLOTS", () => {
  it("keeps every footprint inside the hero — a card measured against the frame can never be cropped", () => {
    for (const [id, r] of Object.entries(FRAME_SLOTS)) {
      expect(r.x0, id).toBeGreaterThanOrEqual(0);
      expect(r.y0, id).toBeGreaterThanOrEqual(0);
      expect(r.x1, id).toBeLessThanOrEqual(100);
      expect(r.y1, id).toBeLessThanOrEqual(100);
      expect(r.x1, id).toBeGreaterThan(r.x0);
      expect(r.y1, id).toBeGreaterThan(r.y0);
    }
  });

  it("gives every card its own air — no two footprints overlap", () => {
    const ids = Object.keys(FRAME_SLOTS) as SlotId[];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(overlaps(FRAME_SLOTS[ids[i]], FRAME_SLOTS[ids[j]]), `${ids[i]} / ${ids[j]}`).toBe(
          false,
        );
      }
    }
  });

  it("leaves the tower unobstructed — nothing is parked over the mast or the deck", () => {
    // The keep-out the tower sweeps through across every hero in `HEROES`: mast tip to the
    // foot of the operational deck, at its widest. The engine readout is the one thing
    // deliberately inside it, sitting under the deck as its label.
    const towerColumn = { x0: 42, y0: 32, x1: 56, y1: 86 };
    for (const [id, r] of Object.entries(FRAME_SLOTS)) {
      if (id === "engine") continue;
      expect(overlaps(r, towerColumn), id).toBe(false);
    }
  });
});

describe("scene space and frame space stay registered to each other", () => {
  it("keeps the tower within a percent of the same point in the frame at every desktop hero", () => {
    // This is the whole licence for drawing the rays against the plate and the cards
    // against the hero: `cover` crops one axis at a time, about the centre, so the tower
    // barely moves in frame terms however the hero is shaped.
    const seen = HEROES.map(([, hw, hh]) => toFrame({ x: PLATE.burstX, y: PLATE.burstY }, hw, hh));
    for (const [i, [name]] of HEROES.entries()) {
      expect(seen[i].x, name).toBeGreaterThan(48);
      expect(seen[i].x, name).toBeLessThan(50);
      expect(seen[i].y, name).toBeGreaterThan(59);
      expect(seen[i].y, name).toBeLessThan(62);
    }
  });

  it("never lets the crop reach a landing — every flow ends somewhere still on screen", () => {
    const landings = [...Object.values(SLOT_HOTSPOT), ...FREE_ANCHORS];
    for (const [name, hw, hh] of HEROES) {
      for (const landing of landings) {
        const f = toFrame(landing, hw, hh);
        const where = `${name} @ ${landing.x},${landing.y}`;
        expect(f.x, where).toBeGreaterThan(2);
        expect(f.x, where).toBeLessThan(98);
        // A marker chip is drawn *above* its landing, so the top needs real clearance.
        expect(f.y, where).toBeGreaterThan(14);
        expect(f.y, where).toBeLessThan(97);
      }
    }
  });

  it("fills the hero at every desktop shape — the plate is never letterboxed", () => {
    for (const [name, hw, hh] of HEROES) {
      const s = Math.max(hw / PLATE.width, hh / PLATE.height);
      expect(PLATE.width * s, name).toBeGreaterThanOrEqual(hw - 0.5);
      expect(PLATE.height * s, name).toBeGreaterThanOrEqual(hh - 0.5);
    }
  });
});

describe("slotVars", () => {
  it("expresses a footprint as percentages of the hero, so a card holds its place at any size", () => {
    const vars = slotVars("healthy");
    const r = FRAME_SLOTS.healthy;
    expect(vars["--slot-l"]).toBe(`${r.x0.toFixed(3)}%`);
    expect(vars["--slot-w"]).toBe(`${(r.x1 - r.x0).toFixed(3)}%`);
    expect(vars["--slot-t"]).toBe(`${r.y0.toFixed(3)}%`);
    expect(vars["--slot-h"]).toBe(`${(r.y1 - r.y0).toFixed(3)}%`);
  });
});

describe("slotHotspot", () => {
  it("lands between the engine and the card that reports it, and never underneath it", () => {
    for (const slot of Object.keys(SLOT_HOTSPOT) as SlotId[]) {
      const hotspot = slotHotspot(slot);
      const card = FRAME_SLOTS[slot];
      for (const [name, hw, hh] of HEROES) {
        const f = toFrame(hotspot, hw, hh);
        const tower = toFrame({ x: PLATE.burstX, y: PLATE.burstY }, hw, hh);
        const where = `${slot} @ ${name}`;
        // Outside the card it feeds — the ray stops short of the panel, and the card's own
        // leader tail covers the rest.
        expect(overlaps({ x0: f.x, y0: f.y, x1: f.x, y1: f.y }, card), where).toBe(false);
        // …and genuinely on the way out, not behind the engine.
        expect(Math.hypot(f.x - tower.x, f.y - tower.y), where).toBeGreaterThan(8);
      }
    }
  });

  it("falls back to a point on the way to the card for a slot with no measured landing", () => {
    const fallback = slotHotspot("active-run");
    // Above the engine, because that is where the card is.
    expect(fallback.y).toBeLessThan(PLATE.burstY);
    expect(Math.abs(fallback.x - PLATE.burstX)).toBeLessThan(PLATE.width / 4);
  });
});

describe("layoutOverlay", () => {
  const channels = buildChannels({ catalogHealth, reviewCounts: { counts, totalOpen: 400 } });

  it("aims a channel's flow at the hotspot of the card that reports it", () => {
    const anchor = slotHotspot("tier0");
    const node = layoutOverlay(channels, { "review-TIER0_APPROVAL": anchor }).find(
      (n) => n.id === "review-TIER0_APPROVAL",
    )!;
    expect(node.x).toBeCloseTo(anchor.x, 6);
    expect(node.y).toBeCloseTo(anchor.y, 6);
  });

  it("gives every unanchored channel its own patch of open city, never two on the same spot", () => {
    const placed = layoutOverlay(channels);
    const seen = new Set(placed.map((n) => `${n.x},${n.y}`));
    expect(seen.size).toBe(Math.min(channels.length, FREE_ANCHORS.length));
  });

  it("starts every flow at the tower and points it at its landing", () => {
    for (const node of layoutOverlay(channels)) {
      // The origin sits on the segment from the burst to the landing, clear of the burst.
      const toOrigin = Math.hypot(node.originX - PLATE.burstX, node.originY - PLATE.burstY);
      const toNode = Math.hypot(node.x - PLATE.burstX, node.y - PLATE.burstY);
      expect(toOrigin).toBeGreaterThan(0);
      expect(toOrigin).toBeLessThan(toNode);
      // …and the bearing is the direction it actually travels.
      const bearing = (Math.atan2(node.y - node.originY, node.x - node.originX) * 180) / Math.PI;
      expect(node.angleDeg).toBeCloseTo(bearing, 4);
    }
  });

  it("is deterministic — the same channels always produce the same composition", () => {
    expect(layoutOverlay(channels)).toEqual(layoutOverlay(channels));
  });

  it("scales intensity against the largest channel so a small queue does not shout as loudly as a large one", () => {
    const placed = layoutOverlay(channels);
    const below = placed.find((c) => c.id === "review-BELOW_THRESHOLD")!;
    const ambiguous = placed.find((c) => c.id === "review-AMBIGUOUS")!;
    expect(below.intensity).toBe(1);
    expect(ambiguous.intensity).toBeLessThan(below.intensity);
    expect(ambiguous.intensity).toBeGreaterThan(0);
  });

  it("gives a zero-count channel zero intensity — no light for work that does not exist", () => {
    const placed = layoutOverlay(channels);
    expect(placed.find((c) => c.id === "review-CONFLICTING")!.intensity).toBe(0);
  });

  it("handles an empty channel set", () => {
    expect(layoutOverlay([])).toEqual([]);
  });
});

describe("bucketCompleteness", () => {
  it("reads the midpoint out of a range label rather than assuming bucket order", () => {
    expect(bucketCompleteness("51-75%", 0, 4)).toBeCloseTo(0.63, 2);
    expect(bucketCompleteness("0-25%", 0, 4)).toBeCloseTo(0.125, 3);
    expect(bucketCompleteness("75-100%", 3, 4)).toBeCloseTo(0.875, 3);
  });

  it("falls back to ordinal position when a label is not parseable, keeping the ordering", () => {
    expect(bucketCompleteness("low", 0, 4)).toBe(0);
    expect(bucketCompleteness("high", 3, 4)).toBe(1);
  });
});

describe("taperedBeamPath", () => {
  it("spreads from the start width to the end width, symmetrically about the axis", () => {
    // Due east, so the perpendicular is straight down the y axis and the numbers are
    // readable by eye.
    expect(taperedBeamPath(0, 0, 100, 0, 4, 20)).toBe("M0 2L100 10L100 -10L0 -2Z");
  });

  it("emits nothing for a zero-length flow rather than a path full of NaNs", () => {
    expect(taperedBeamPath(50, 50, 50, 50, 4, 20)).toBe("");
  });

  it("stays symmetric whatever the bearing", () => {
    const d = taperedBeamPath(0, 0, 0, 100, 4, 20);
    expect(d.startsWith("M-2 0")).toBe(true);
    expect(d).toContain("L2 0Z");
  });
});

describe("chevronMarkPath", () => {
  it("draws the requested number of chevrons, each pointing along +x", () => {
    const d = chevronMarkPath(10, 3);
    expect(d.match(/M/g)).toHaveLength(3);
    // Every chevron is an open vee: back, tip, back.
    expect(d.match(/L/g)).toHaveLength(6);
  });

  it("stacks them outward along the flow rather than on top of each other", () => {
    const one = chevronMarkPath(10, 1);
    const two = chevronMarkPath(10, 2);
    expect(two.startsWith(one)).toBe(true);
    expect(two.length).toBeGreaterThan(one.length);
  });
});
