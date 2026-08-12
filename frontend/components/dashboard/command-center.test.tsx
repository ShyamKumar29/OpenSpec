import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommandCenter } from "./command-center";
import type { CommandChannel } from "@/lib/dashboard/command-center";

// The beams themselves are clickable (they navigate via `useRouter().push`, on top of the
// real `<Link>`s the markers/callouts already render) — `useRouter` requires an App Router
// context these component tests don't mount, so it's swapped for a stub. `Link` needs no
// such stub: it degrades to a plain anchor outside a router context, which is exactly what
// the rest of this file already relies on. `pushMock` is hoisted so both the mock factory
// (which vitest hoists above the imports) and the tests below share the same instance.
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

/**
 * The command center's one hard promise is that the picture never says anything the data
 * does not. These tests hold it to that: the SVG is decoration a screen reader never sees,
 * every fact it draws is also a real link with real text, and the motion in it is a
 * function of `live` — a run that is not running must not animate anything.
 */
const channels: CommandChannel[] = [
  {
    id: "auto-accepted",
    label: "Commerce-ready",
    value: 171,
    detail: "Straight-through on every auto-eligible attribute.",
    tone: "healthy",
    href: "/catalog?status=ACCEPTED",
  },
  {
    id: "review-TIER0_APPROVAL",
    label: "Tier-0 approval",
    value: 96,
    detail: "Never auto-accepted (INV-9).",
    tone: "attention",
    href: "/review?reason_code=TIER0_APPROVAL",
  },
  {
    id: "review-CONFLICTING",
    label: "Conflicting",
    value: 0,
    detail: "Two sources disagree.",
    tone: "critical",
    href: "/review?reason_code=CONFLICTING",
  },
];

function renderCentre(props: Partial<React.ComponentProps<typeof CommandCenter>> = {}) {
  return render(<CommandCenter channels={channels} totalRecords={240} live={false} {...props} />);
}

describe("CommandCenter", () => {
  it("renders every channel as a real link carrying its count, tone word, and explanation", () => {
    renderCentre();
    // One chip in the floating layer and one in the small-screen list — same data, one
    // of the two hidden by CSS at any given width.
    const commerceReady = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/catalog?status=ACCEPTED");
    expect(commerceReady.length).toBeGreaterThan(0);
    expect(commerceReady[0]).toHaveTextContent("171");
    expect(commerceReady[0]).toHaveTextContent("Healthy");
    expect(commerceReady[0]).toHaveTextContent("Straight-through on every auto-eligible");
  });

  it("keeps a zero-count channel visible — 'zero conflicts' is operational information", () => {
    renderCentre();
    const conflicting = screen
      .getAllByTestId("command-channel")
      .filter((el) => el.getAttribute("href") === "/review?reason_code=CONFLICTING");
    expect(conflicting.length).toBeGreaterThan(0);
    expect(conflicting[0]).toHaveTextContent("0");
  });

  it("hides the whole drawing from assistive technology — it is decoration, and the chips carry the facts", () => {
    const { container } = renderCentre();
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("the beam is itself a real navigation target — clicking anywhere along the ray goes to the channel's page", () => {
    pushMock.mockClear();
    const { container } = renderCentre();
    const title = Array.from(container.querySelectorAll("title")).find((t) =>
      t.textContent?.startsWith("Commerce-ready"),
    );
    expect(title).toBeTruthy();
    // The <title> and the invisible fat hit-path live inside the same interactive <g> the
    // click/hover handlers are bound to.
    fireEvent.click(title!.parentElement!);
    expect(pushMock).toHaveBeenCalledWith("/catalog?status=ACCEPTED");
  });

  it("hovering the beam highlights it, and the marker chip shares the same hovered state", () => {
    const { container } = renderCentre();
    const title = Array.from(container.querySelectorAll("title")).find((t) =>
      t.textContent?.startsWith("Commerce-ready"),
    );
    const beamGroup = title!.parentElement as HTMLElement;
    expect(beamGroup.getAttribute("style") ?? "").not.toContain("brightness");
    fireEvent.pointerEnter(beamGroup);
    expect(beamGroup.getAttribute("style")).toContain("brightness");
    fireEvent.pointerLeave(beamGroup);
    expect(beamGroup.getAttribute("style") ?? "").not.toContain("brightness");
  });

  it("emits no motion at all when no run is in flight", () => {
    const { container } = renderCentre({ live: false });
    expect(container.querySelectorAll(".os-flow")).toHaveLength(0);
    expect(container.querySelectorAll(".os-core-pulse")).toHaveLength(0);
    expect(container.querySelectorAll(".os-beacon")).toHaveLength(0);
    expect(container.querySelectorAll(".os-sweep")).toHaveLength(0);
  });

  it("animates the engine and the channels that carry work once a run is genuinely running", () => {
    const { container } = renderCentre({ live: true });
    expect(container.querySelectorAll(".os-core-pulse").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".os-sweep").length).toBeGreaterThan(0);
    const packets = container.querySelectorAll(".os-flow");
    expect(packets.length).toBeGreaterThan(0);
    // …but never along the channel with nothing in it.
    expect(packets.length).toBeLessThanOrEqual((channels.length - 1) * 3);
  });

  it("shows the total record count at the engine's base", () => {
    renderCentre();
    expect(screen.getByText("240 records")).toBeInTheDocument();
  });

  it("renders the instrument slots it is given, exactly once each", () => {
    renderCentre({
      overviewSlot: <p>run overview</p>,
      statusSlot: <p>operational state</p>,
      legendSlot: <p>flow legend</p>,
      calloutSlots: [
        {
          id: "tier0",
          channelId: "review-TIER0_APPROVAL",
          slot: "tier0",
          content: <p>tier-0 callout</p>,
        },
      ],
    });
    // One DOM node each, re-positioned by CSS at `xl` rather than duplicated — a second
    // copy would be announced twice by a screen reader.
    expect(screen.getAllByText("run overview")).toHaveLength(1);
    expect(screen.getAllByText("operational state")).toHaveLength(1);
    expect(screen.getAllByText("flow legend")).toHaveLength(1);
    expect(screen.getAllByText("tier-0 callout")).toHaveLength(1);
  });

  it("does not also float a node marker for a channel a callout is already reporting on", () => {
    // Without a callout, Tier-0 gets its own marker chip *and* a row in the small-screen
    // list — two links to the same place.
    const { container: withoutCallout } = renderCentre();
    const before = withoutCallout.querySelectorAll(
      '[data-testid="command-channel"][href="/review?reason_code=TIER0_APPROVAL"]',
    ).length;
    expect(before).toBe(2);

    const { container } = renderCentre({
      calloutSlots: [
        {
          id: "tier0",
          channelId: "review-TIER0_APPROVAL",
          slot: "tier0",
          content: <p>tier-0 callout</p>,
        },
      ],
    });
    // With one, the floating marker is dropped: the card is that beam's label. The
    // small-screen list row stays, because that layer has no callouts on it.
    expect(
      container.querySelectorAll(
        '[data-testid="command-channel"][href="/review?reason_code=TIER0_APPROVAL"]',
      ),
    ).toHaveLength(1);
    // …and no other channel loses its marker.
    expect(
      container.querySelectorAll(
        '[data-testid="command-channel"][href="/catalog?status=ACCEPTED"]',
      ),
    ).toHaveLength(2);
  });

  it("still shows every channel to a screen reader when the picture is doing the talking", () => {
    renderCentre({
      calloutSlots: channels.map((c, i) => ({
        id: c.id,
        channelId: c.id,
        slot: (["healthy", "tier0", "validation"] as const)[i],
        content: <p>{c.label} callout</p>,
      })),
    });
    // Every channel is suppressed from the floating layer, but the stacked list — which
    // is only hidden by CSS — still carries all of them as real links.
    for (const channel of channels) {
      const links = screen
        .getAllByTestId("command-channel")
        .filter((el) => el.getAttribute("href") === channel.href);
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveTextContent(String(channel.value));
    }
  });
});
