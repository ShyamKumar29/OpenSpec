"use client";

/**
 * The dashboard's operational command center — the hero of `/`, and the one place in
 * OpenSpec that answers "what is the enrichment system doing, right now" in a single
 * glance, without scrolling.
 *
 * **The environment is a photograph, not a drawing.**
 * `public/dashboard/command-center-city.webp` is an industrial site seen from the air: the
 * enrichment tower at its centre — lattice shaft, deck, mast, beacon, and the lit
 * operational rings around its foot — the districts of the catalog around it, and the
 * depth between them. Nothing in this file redraws any of that. An earlier version
 * generated the city and the tower from the completeness histogram in SVG, and the honest
 * assessment was that a few thousand generated rectangles will not stand next to a rendered
 * environment; the plate replaced it wholesale.
 *
 * What this file does own is the **intelligence layer** over that plate:
 *
 * - **Instruments** — the run/system overview, the operational-state summary and the flow
 *   key, in their footprints around the frame (`FRAME_SLOTS`).
 * - **Hotspots** — the callout cards, ringed around the tower on the side of the site they
 *   report on, each carrying a real number and each a link into the page that owns it.
 * - **Flows** — one animated ray per channel, from the tower out to the hotspot it feeds.
 *   The plate's own rays are the ambient scene; these are the live ones, and they are
 *   derived: taper, packet count and endpoint size all scale with the real count, a channel
 *   with a zero count emits no energy at all, and nothing moves unless a run is genuinely in
 *   flight (`live`).
 *
 * The one structural trick is that those three do not all live in the same coordinate
 * system, and `lib/dashboard/command-center.ts` explains at length why. In short: the rays
 * and their landings are in the plate's own pixels because they have to agree with the
 * picture, while the cards are in percentages of the hero box because they have to stay on
 * screen — a hero shaped differently from the plate crops the plate's edges, and a card
 * parked on one goes with it. The two are joined by the tower, which `cover` keeps within
 * about a percent of the same spot in both systems, and by each card's own CSS leader tail,
 * which covers the last stretch between a hotspot and the panel that names it.
 *
 * Responsive tiers, and what each one gives up:
 *
 * - `xl` and up — the full composition, the scene taking the page's leftover height so the
 *   dashboard fits one viewport, and the flow key as well as everything below.
 * - `lg` — the same composition over a plate-shaped band rather than the leftover height,
 *   at tighter widths, and without the key, for which there is no longer room.
 * - below `lg` — the picture becomes a banner: no floating layer at all, the instruments
 *   and callouts stack underneath it, and every channel becomes a plain row in a list.
 *
 * Accessibility: the plate and the flow overlay are decoration in their entirety
 * (`alt=""` / `aria-hidden`) — every fact they carry is also in an HTML link layered over
 * them or listed under them, each with real text, an icon and an `sr-only` state word
 * (NFR-ACC-3), so nothing is encoded by colour or position alone. All motion is decorative
 * and stops under `prefers-reduced-motion` (see `globals.css`).
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, OctagonAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLATE,
  chevronMarkPath,
  layoutOverlay,
  slotHotspot,
  slotVars,
  taperedBeamPath,
  type ChannelTone,
  type CommandChannel,
  type PositionedChannel,
  type SlotId,
} from "@/lib/dashboard/command-center";

/**
 * The environment plate.
 *
 * Graded from `command-center-wide.webp`, which is kept beside it as the source: same
 * 1940x716 geometry, so every coordinate in `lib/dashboard/command-center.ts` still lands
 * on the same building, with the low-frequency veil subtracted (harder across the top,
 * where the source's fog band was thickest), the frame graded down at the top and the outer
 * field, and the side padding rebuilt as a crisp mirror of the composition's outermost
 * strip falling into shadow rather than a blurred one dissolving into cloud. The city, its
 * districts and the tower's own lattice are legible as a result; the previous cut read as a
 * gradient with lights on it.
 *
 * Next's image optimizer caches by URL, so a re-cut under the old name serves the previous
 * one from cache — which `cover` then silently zooms into if the two are not identically
 * shaped. Every re-cut gets a new name.
 */
const PLATE_SRC = "/dashboard/command-center-city.webp";

/** How an instrument takes up its footprint in the hero. A plain block in the stacked
 *  small-screen column, and an annotation pinned to its `--slot-*` rectangle from `lg` up.
 *  The height is a floor rather than a fixed size, so a panel whose real values need more
 *  room grows down into the site instead of clipping them. */
const SLOT_CLASS =
  "lg:pointer-events-auto lg:absolute lg:top-[var(--slot-t)] lg:left-[var(--slot-l)] lg:w-[var(--slot-w)] lg:min-h-[var(--slot-h)]";

/** Variants for the two small plates that are a line of text rather than a panel. Both take
 *  their footprint as a *bound* and size to their content inside it, because a pill
 *  stretched across 500px of desktop reads as an empty box with a label in the corner
 *  rather than as an instrument. The key hangs from the left of its footprint; the engine
 *  readout stays centred in its own, because it is the label for the tower above it. */
const SLOT_CLASS_FIT = `${SLOT_CLASS} lg:w-fit lg:max-w-[var(--slot-w)] lg:min-h-0`;
const SLOT_CLASS_CENTRE = `${SLOT_CLASS} lg:flex lg:min-h-0 lg:justify-center`;

const TONE_VAR: Record<ChannelTone, string> = {
  healthy: "var(--env-healthy)",
  attention: "var(--env-attention)",
  critical: "var(--env-critical)",
  idle: "var(--env-idle)",
};

const TONE_TEXT: Record<ChannelTone, string> = {
  healthy: "text-[var(--env-healthy)]",
  attention: "text-[var(--env-attention)]",
  critical: "text-[var(--env-critical)]",
  idle: "text-[var(--env-idle)]",
};

const TONE_ICON: Record<ChannelTone, LucideIcon> = {
  healthy: CheckCircle2,
  attention: AlertTriangle,
  critical: OctagonAlert,
  idle: Circle,
};

const TONE_WORD: Record<ChannelTone, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  critical: "Critical",
  idle: "Idle",
};

/** The stacked small-screen list sits on the normal card surface, not the environment, so
 *  it uses the page's own status hues rather than the on-environment ones. */
const TONE_TEXT_ONCARD: Record<ChannelTone, string> = {
  healthy: "text-status-accepted",
  attention: "text-status-needs-review",
  critical: "text-status-rejected",
  idle: "text-muted-foreground",
};

export interface CommandCenterCallout {
  id: string;
  /** The channel this card reports on, so that channel's own node marker is suppressed
   *  (the card *is* its label) and its flow is aimed at this card. `null` for a callout
   *  that summarises something other than one channel — the active run, say. */
  channelId: string | null;
  /** Which footprint of the composition the card occupies. */
  slot: SlotId;
  content: React.ReactNode;
}

export interface CommandCenterProps {
  channels: CommandChannel[];
  /** Total catalog records, shown on the engine readout under the plaza. */
  totalRecords: number | null;
  /** True only while a run is genuinely in flight; drives the plaza pulse, the site sweep,
   *  the packet flow along the rays and the landing beacons. */
  live: boolean;
  overviewSlot?: React.ReactNode;
  statusSlot?: React.ReactNode;
  legendSlot?: React.ReactNode;
  calloutSlots?: CommandCenterCallout[];
  className?: string;
}

/** One node link. Shared by the compact markers bolted to the environment and the stacked
 *  small-screen list, so the two can never drift apart. */
function ChannelChip({ channel, layout }: { channel: CommandChannel; layout: "floating" | "row" }) {
  const Icon = TONE_ICON[channel.tone];
  const floating = layout === "floating";
  return (
    <Link
      href={channel.href}
      data-testid="command-channel"
      data-tone={channel.tone}
      title={`${channel.label} — ${channel.detail}`}
      className={cn(
        "group focus-visible:ring-ring rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
        floating
          ? // A solid instrument marker bolted onto the environment — opaque, not glass,
            // so the text keeps its contrast over whatever part of the site it lands on.
            "shadow-elevation-3 flex w-[7.25rem] flex-col gap-0.5 border border-[var(--env-panel-border)] bg-[var(--env-panel)] px-1.5 py-1 hover:border-[var(--env-panel-border-hover)]"
          : "border-border bg-card hover:border-foreground/40 flex items-center justify-between gap-3 border px-3 py-2",
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-start gap-1",
          floating ? TONE_TEXT[channel.tone] : TONE_TEXT_ONCARD[channel.tone],
        )}
      >
        <Icon className={cn("size-2.5 shrink-0", floating && "mt-px")} aria-hidden="true" />
        <span className={cn("label-caps", floating ? "label-caps-xs" : "truncate")}>
          {channel.label}
        </span>
      </span>
      <span
        className={cn(
          "metric font-bold",
          floating
            ? "text-[13px] leading-none text-[var(--env-ink)]"
            : "text-foreground shrink-0 text-sm",
        )}
      >
        {channel.value.toLocaleString()}
      </span>
      <span className="sr-only">
        {" "}
        — {TONE_WORD[channel.tone]}. {channel.detail}
      </span>
    </Link>
  );
}

/**
 * One live flow: a ray of light thrown from the tower to the hotspot it feeds, travelling
 * packets, and a landing mark that says the ray arrived somewhere rather than faded out.
 *
 * The ray is itself a navigation control, not just the chip at its end: a generous
 * invisible hit-path follows the same line, so hovering or clicking *anywhere along it*
 * highlights the flow and jumps to `node.href` — the same destination the marker or callout
 * for this channel already links to. The SVG stays `aria-hidden` (the HTML overlay is what
 * a screen reader and keyboard user navigate with), so no `tabIndex` or `role` is added
 * here; that would create a focusable element assistive tech can never reach.
 */
function Flow({
  node,
  live,
  hovered,
  onHoverChange,
  onActivate,
}: {
  node: PositionedChannel;
  live: boolean;
  hovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  onActivate: () => void;
}) {
  const colour = TONE_VAR[node.tone];
  const ends = { x1: node.originX, y1: node.originY, x2: node.x, y2: node.y };
  const i = node.intensity;

  const interactive = (children: React.ReactNode) => (
    <g
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      onClick={onActivate}
      style={{
        cursor: "pointer",
        filter: hovered ? "brightness(1.5)" : undefined,
        transition: "filter 120ms ease",
      }}
    >
      <title>{`${node.label} — ${node.value.toLocaleString()}. ${node.detail}`}</title>
      {children}
      <line {...ends} stroke="transparent" strokeWidth={26} style={{ pointerEvents: "stroke" }} />
    </g>
  );

  if (i === 0) {
    // No work in this channel. The path stays so the composition keeps its shape, but
    // nothing travels down it and nothing glows at the end of it. Still a real destination
    // ("zero conflicts" is operational information too), so it stays interactive.
    return interactive(
      <>
        <line
          {...ends}
          stroke="var(--env-idle)"
          strokeWidth={hovered ? 1.75 : 1}
          strokeDasharray="3 10"
          opacity={hovered ? 0.6 : 0.34}
        />
        <circle
          cx={node.x}
          cy={node.y}
          r={hovered ? 6.5 : 5}
          fill="none"
          stroke="var(--env-idle)"
          strokeWidth={1.25}
          opacity={hovered ? 0.75 : 0.45}
        />
      </>,
    );
  }

  const packets = 1 + Math.round(i * 2);
  const duration = 3.4 - i * 1.5;
  const gradientId = `os-flow-${node.id}`;

  return interactive(
    <>
      <defs>
        {/* Brightness along the throw: hot at the tower, easing off as it travels. In user
            space, so it follows the ray's own bearing rather than a bounding box. */}
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={ends.x1}
          y1={ends.y1}
          x2={ends.x2}
          y2={ends.y2}
        >
          <stop offset="0%" stopColor={colour} stopOpacity="0.95" />
          <stop offset="62%" stopColor={colour} stopOpacity="0.7" />
          <stop offset="100%" stopColor={colour} stopOpacity="0.45" />
        </linearGradient>
      </defs>

      {/* A soft throw under the core, so the ray sits *in* the plate's atmosphere rather
          than on top of the photograph. */}
      <path
        d={taperedBeamPath(ends.x1, ends.y1, ends.x2, ends.y2, 3 + i * 4, 16 + i * 26)}
        fill={`url(#${gradientId})`}
        opacity={0.14 + i * 0.13}
      />
      <path
        d={taperedBeamPath(ends.x1, ends.y1, ends.x2, ends.y2, 1.5 + i * 2, 5 + i * 9)}
        fill={`url(#${gradientId})`}
        opacity={0.4 + i * 0.28}
      />
      {/* The hot core: a hairline of near-white light down the middle, which is what stops
          a saturated fill from reading as flat paint. */}
      <line
        {...ends}
        stroke="var(--env-ink)"
        strokeWidth={0.7 + i * 0.9}
        strokeLinecap="round"
        opacity={0.2 + i * 0.34}
      />
      {live
        ? Array.from({ length: packets }, (_, p) => (
            <line
              key={p}
              {...ends}
              className="os-flow"
              stroke={colour}
              strokeWidth={2.5 + i * 3.5}
              strokeLinecap="round"
              opacity={0.92}
              style={{
                animationDuration: `${duration}s`,
                animationDelay: `${(p / packets) * duration}s`,
              }}
            />
          ))
        : null}

      {/* Landing: a lit patch of ground, a mast planted in it so the mark reads as put
          there rather than as a place the ray happened to stop, a ring on a shaded pad so
          it stays legible over a bright quarter of the plate, and an outward chevron
          stack. */}
      <line
        x1={node.x}
        y1={node.y - (26 + i * 12)}
        x2={node.x}
        y2={node.y}
        stroke={colour}
        strokeWidth={1.25}
        opacity={0.5 + i * 0.25}
      />
      <ellipse
        cx={node.x}
        cy={node.y}
        rx={22 + i * 24}
        ry={(22 + i * 24) * 0.4}
        fill={`url(#os-glow-${node.tone})`}
        opacity={0.6}
      />
      <ellipse
        cx={node.x}
        cy={node.y}
        rx={13 + i * 11}
        ry={(13 + i * 11) * 0.4}
        fill="var(--env-deep)"
        opacity={0.42}
      />
      <ellipse
        cx={node.x}
        cy={node.y}
        rx={13 + i * 11}
        ry={(13 + i * 11) * 0.4}
        fill="none"
        stroke={colour}
        strokeWidth={1.75}
        opacity={0.95}
      />
      <g
        transform={`translate(${node.x} ${node.y}) rotate(${node.angleDeg}) translate(${20 + i * 12} 0)`}
        opacity={0.7 + i * 0.3}
      >
        <path
          d={chevronMarkPath(9 + i * 4)}
          fill="none"
          stroke={colour}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      {live ? (
        <circle
          cx={node.x}
          cy={node.y}
          r={3.5 + i * 3}
          fill={colour}
          className="os-beacon"
          style={{ animationDelay: `${i * 1.4}s` }}
        />
      ) : (
        <circle cx={node.x} cy={node.y} r={3.5 + i * 3} fill={colour} opacity={0.7} />
      )}
    </>,
  );
}

export function CommandCenter({
  channels,
  totalRecords,
  live,
  overviewSlot,
  statusSlot,
  legendSlot,
  calloutSlots = [],
  className,
}: CommandCenterProps) {
  const router = useRouter();
  // Which ray is currently under the pointer — shared between the flow and its own marker
  // chip so hovering either end highlights the whole thing, not just the half you touched.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // A channel a callout card is already reporting on aims its flow at that card and does
  // not also get its own node marker: the card is that ray's label, and two labels on one
  // endpoint is the clutter this composition exists to avoid.
  const anchors: Record<string, { x: number; y: number }> = {};
  for (const slot of calloutSlots) {
    if (slot.channelId) anchors[slot.channelId] = slotHotspot(slot.slot);
  }
  const nodes = layoutOverlay(channels, anchors);
  const markerNodes = nodes.filter((n) => !(n.id in anchors));

  // The stage *covers* the hero at exactly the plate's aspect ratio: it fills the width at
  // every desktop size, and what overflows is the atmospheric margin the plate carries for
  // precisely this purpose (`PLATE_MARGIN`). The SVG's viewBox and the node markers are
  // both relative to this box, so they agree with the image and with each other whatever
  // shape the hero is. The card layer is not — see the note above it.
  const stageVars = {
    "--stage-w": `max(100cqw, calc(100cqh * ${PLATE.width} / ${PLATE.height}))`,
    "--stage-h": `max(100cqh, calc(100cqw * ${PLATE.height} / ${PLATE.width}))`,
  } as React.CSSProperties;

  const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;

  return (
    <div
      data-testid="command-center"
      className={cn(
        "os-env border-border relative flex flex-col overflow-hidden rounded-sm border",
        className,
      )}
    >
      {/* --- The hero. Below `lg` it is a plate-shaped banner with the instruments stacked
             under it; at `lg` it is the composition over a plate-shaped band; at `xl` it
             takes whatever height the one-viewport layout has left. `container-type` is
             what lets the contain-sizing below be pure CSS. --- */}
      <div
        className="relative flex flex-col lg:[container-type:size] lg:block lg:aspect-[1324/716] xl:aspect-auto xl:min-h-0 xl:flex-1"
        style={stageVars}
      >
        {/* `1324/716` is the *composition's* ratio, not the plate's: where the hero is a
            fixed-aspect band rather than leftover height, it takes the shape the scene was
            framed in and `cover` crops the plate's margins away entirely. */}
        <div className="relative aspect-[1324/716] w-full lg:absolute lg:inset-0 lg:aspect-auto">
          {/* Bleed: the plate again, blurred and pushed back, filling whatever the hero's
              shape leaves over. A letterbox bar would frame the composition; this makes the
              environment simply continue past the edge of the frame. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-45 blur-2xl"
            style={{ backgroundImage: `url(${PLATE_SRC})` }}
          />

          <div className="absolute inset-0 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-[var(--stage-h)] lg:w-[var(--stage-w)] lg:-translate-x-1/2 lg:-translate-y-1/2">
            {/* The environment. Decoration in full: every fact it carries is also an HTML
                link over it or a row under it. */}
            {/* Feathered at the frame, so where the hero is not the plate's shape the
                environment dissolves into the bleed behind it instead of ending on a hard
                edge with a visible sharp/blurred seam down it. */}
            <Image
              src={PLATE_SRC}
              alt=""
              aria-hidden="true"
              fill
              priority
              // Served as authored. The plate is already a hand-tuned WebP at exactly the
              // size it ships at, so the optimizer has nothing to win — and it has two
              // things to lose: it re-encodes per requested width (slow enough at this
              // pixel count to stall the page's LCP image), and it caches by URL, which
              // silently serves a previous cut of the plate after the file is re-made.
              unoptimized
              className="pointer-events-none [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent),linear-gradient(to_bottom,transparent,black_3%,black_97%,transparent)] [mask-composite:intersect] object-cover select-none"
            />

            {/* Rotating site sweep over the plaza — present only while a run is in flight.
                An HTML layer rather than an SVG one because a conic gradient clipped to an
                ellipse is the one effect SVG makes awkward. */}
            {live ? (
              <div
                aria-hidden="true"
                className="absolute overflow-hidden rounded-[50%] opacity-40"
                style={{
                  left: pct(PLATE.plazaX - PLATE.plazaRx * 3.4, PLATE.width),
                  top: pct(PLATE.plazaY - PLATE.plazaRy * 3.4, PLATE.height),
                  width: pct(PLATE.plazaRx * 6.8, PLATE.width),
                  height: pct(PLATE.plazaRy * 6.8, PLATE.height),
                }}
              >
                <div
                  className="os-sweep absolute top-1/2 left-1/2 aspect-square w-[140%] -translate-x-1/2 -translate-y-1/2"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--env-line) 26%, transparent) 20deg, transparent 54deg, transparent 360deg)",
                  }}
                />
              </div>
            ) : null}

            <svg
              viewBox={`0 0 ${PLATE.width} ${PLATE.height}`}
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
              focusable="false"
              preserveAspectRatio="none"
            >
              <defs>
                {(["healthy", "attention", "critical", "idle"] as ChannelTone[]).map((tone) => (
                  <radialGradient key={tone} id={`os-glow-${tone}`}>
                    <stop offset="0%" stopColor={TONE_VAR[tone]} stopOpacity="0.62" />
                    <stop offset="100%" stopColor={TONE_VAR[tone]} stopOpacity="0" />
                  </radialGradient>
                ))}
              </defs>

              {/* The engine's own instrument ring, sitting just outside the deck's lit
                  edge with a tick at each cardinal — the always-on marker that says this
                  is the point every flow leaves from, whether or not a run is in flight.
                  Squashed onto the plate's ground plane like everything else on the deck. */}
              <g
                transform={`translate(${PLATE.plazaX} ${PLATE.plazaY}) scale(1 ${(
                  PLATE.plazaRy / PLATE.plazaRx
                ).toFixed(3)})`}
                opacity={0.5}
              >
                <circle
                  r={PLATE.plazaRx * 1.3}
                  fill="none"
                  stroke="var(--env-line)"
                  strokeWidth={1.5}
                  strokeDasharray="2 7"
                />
                {[0, 90, 180, 270].map((deg) => (
                  <line
                    key={deg}
                    x1={PLATE.plazaRx * 1.22}
                    y1={0}
                    x2={PLATE.plazaRx * 1.42}
                    y2={0}
                    stroke="var(--env-line)"
                    strokeWidth={2}
                    transform={`rotate(${deg})`}
                  />
                ))}
              </g>

              {/* The engine, pulsing across the plaza while a run is in flight. Squashed
                  onto the plate's ground plane, so the ring travels along the deck rather
                  than hanging in front of the tower. */}
              {live ? (
                <g
                  transform={`translate(${PLATE.plazaX} ${PLATE.plazaY}) scale(1 ${(
                    PLATE.plazaRy / PLATE.plazaRx
                  ).toFixed(3)}) translate(${-PLATE.plazaX} ${-PLATE.plazaY})`}
                >
                  {[0, 1.8].map((delay) => (
                    <circle
                      key={delay}
                      className="os-core-pulse"
                      cx={PLATE.plazaX}
                      cy={PLATE.plazaY}
                      r={PLATE.plazaRx}
                      fill="none"
                      stroke="var(--env-healthy)"
                      strokeWidth="3"
                      style={{ animationDelay: `${delay}s` }}
                    />
                  ))}
                </g>
              ) : null}

              {nodes.map((node) => (
                <Flow
                  key={node.id}
                  node={node}
                  live={live}
                  hovered={hoveredId === node.id}
                  onHoverChange={(h) => setHoveredId(h ? node.id : null)}
                  onActivate={() => router.push(node.href)}
                />
              ))}
            </svg>

            {/* --- Node markers: the accessible, interactive layer, for every flow the
                   dashboard has not already given a callout card. Percentages map 1:1 onto
                   the viewBox because this element *is* the viewBox. --- */}
            <div className="absolute inset-0 hidden lg:block">
              {markerNodes.map((node) => (
                <div
                  key={node.id}
                  className="absolute pb-4 transition-transform duration-150"
                  style={{
                    left: pct(node.x, PLATE.width),
                    top: pct(node.y, PLATE.height),
                    transform:
                      hoveredId === node.id
                        ? "translate(-50%, -100%) scale(1.06)"
                        : "translate(-50%, -100%)",
                  }}
                  // The chip and its ray are one flow: hovering either highlights both.
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() =>
                    setHoveredId((current) => (current === node.id ? null : current))
                  }
                >
                  <ChannelChip channel={node} layout="floating" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- Instruments and hotspots. One set of DOM nodes: stacked in flow below `lg`,
               and re-positioned by CSS into the composition's own footprints at `lg` and
               up. Never a second copy, so nothing is announced twice.

               This layer is pinned to the *hero*, not to the stage the plate is drawn on:
               a card measured against the plate rides off the top of the frame the moment
               the hero is wider than the plate and `cover` starts cropping it, which is
               precisely what used to slice the run overview in half under the topbar. --- */}
        <div className="flex flex-col gap-2 p-2 lg:pointer-events-none lg:absolute lg:inset-0 lg:p-0">
          {overviewSlot ? (
            <div className={SLOT_CLASS} style={slotVars("overview")}>
              {overviewSlot}
            </div>
          ) : null}
          {legendSlot ? (
            // The key is redundant for assistive technology — every node already carries
            // its tone as a word — so it is the first thing to go when the frame gets tight.
            <div className={cn(SLOT_CLASS_FIT, "hidden xl:block")} style={slotVars("legend")}>
              {legendSlot}
            </div>
          ) : null}
          {statusSlot ? (
            <div className={SLOT_CLASS} style={slotVars("status")}>
              {statusSlot}
            </div>
          ) : null}
          {calloutSlots.map((slot) => (
            <div key={slot.id} className={SLOT_CLASS} style={slotVars(slot.slot)}>
              {slot.content}
            </div>
          ))}
          {/* Engine readout. The plaza it sits under is the brightest part of the frame, so
              it gets its own plate — unbacked text there loses its contrast (NFR-ACC-4). */}
          {totalRecords !== null ? (
            <div
              className={cn(SLOT_CLASS_CENTRE, "self-center lg:self-auto")}
              style={slotVars("engine")}
            >
              <div className="shadow-elevation-3 h-fit rounded-sm border border-[var(--env-panel-border)] bg-[var(--env-panel)]/90 px-2.5 py-1 text-center whitespace-nowrap">
                <div className="label-caps label-caps-xs text-[var(--env-ink-dim)]">
                  Enrichment engine
                </div>
                <div className="metric text-xs font-bold text-[var(--env-ink)]">
                  {totalRecords.toLocaleString()} records
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* --- Small-screen equivalent of the node layer: the same channels, the same links,
             no absolute positioning and no reliance on the picture. --- */}
      <ul className="border-border divide-border divide-y border-t lg:hidden">
        {channels.map((channel) => (
          <li key={channel.id}>
            <ChannelChip channel={channel} layout="row" />
          </li>
        ))}
      </ul>
    </div>
  );
}
