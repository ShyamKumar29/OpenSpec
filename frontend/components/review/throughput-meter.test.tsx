import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThroughputMeter } from "./throughput-meter";

describe("ThroughputMeter", () => {
  it("renders resolved count, rate, median, and baseline together", () => {
    render(
      <ThroughputMeter
        resolvedCount={47}
        ratePerHour={38}
        medianDecisionMs={71_000}
        baselinePerHour={7}
      />,
    );
    expect(screen.getByText(/47 resolved/)).toBeInTheDocument();
    expect(screen.getByText(/38\.0\/hr/)).toBeInTheDocument();
    expect(screen.getByText(/71s/)).toBeInTheDocument();
    expect(screen.getByText(/~7\/hr/)).toBeInTheDocument();
  });

  it("shows the multiple-of-baseline callout when both rates are positive", () => {
    render(
      <ThroughputMeter
        resolvedCount={10}
        ratePerHour={38}
        medianDecisionMs={60_000}
        baselinePerHour={7}
      />,
    );
    expect(screen.getByText("5.4×")).toBeInTheDocument();
  });

  it("omits median and the multiple callout for a fresh session with no decisions yet", () => {
    render(
      <ThroughputMeter
        resolvedCount={0}
        ratePerHour={0}
        medianDecisionMs={null}
        baselinePerHour={7}
      />,
    );
    expect(screen.queryByText(/median/)).not.toBeInTheDocument();
    expect(screen.queryByText(/×$/)).not.toBeInTheDocument();
  });
});
