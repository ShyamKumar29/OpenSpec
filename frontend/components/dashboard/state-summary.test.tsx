import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StateSummary } from "./state-summary";
import type { CommandChannel } from "@/lib/dashboard/command-center";

const channel = (id: string, tone: CommandChannel["tone"], value: number): CommandChannel => ({
  id,
  label: id,
  value,
  detail: "",
  tone,
  href: "/review",
});

const channels: CommandChannel[] = [
  channel("healthy", "healthy", 171),
  channel("critical-a", "critical", 88),
  channel("critical-b", "critical", 12),
  channel("attention-a", "attention", 96),
  channel("attention-b", "attention", 112),
  channel("idle", "idle", 9999),
];

describe("StateSummary", () => {
  it("folds the same channels the visualization is drawn from — no second aggregation", () => {
    render(<StateSummary channels={channels} runningCount={1} totalRuns={6} />);
    expect(screen.getByTestId("state-summary-critical")).toHaveTextContent("100");
    expect(screen.getByTestId("state-summary-attention")).toHaveTextContent("208");
    expect(screen.getByTestId("state-summary-healthy")).toHaveTextContent("171");
  });

  it("reports run state honestly rather than always claiming activity", () => {
    const { rerender } = render(
      <StateSummary channels={channels} runningCount={1} totalRuns={6} />,
    );
    expect(screen.getByText(/of 6 runs active · engine processing/)).toBeInTheDocument();

    rerender(<StateSummary channels={channels} runningCount={0} totalRuns={6} />);
    expect(screen.getByText(/of 6 runs active · engine idle/)).toBeInTheDocument();
  });

  it("routes each state into the page that owns it", () => {
    render(<StateSummary channels={channels} runningCount={1} totalRuns={6} />);
    expect(screen.getByTestId("state-summary-healthy")).toHaveAttribute(
      "href",
      "/catalog?status=ACCEPTED",
    );
    expect(screen.getByTestId("state-summary-attention")).toHaveAttribute("href", "/review");
  });
});
