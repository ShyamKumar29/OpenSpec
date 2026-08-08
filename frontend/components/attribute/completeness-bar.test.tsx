import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompletenessBar } from "./completeness-bar";

describe("CompletenessBar", () => {
  it("renders the filled/total numeral and a full text-equivalent aria-label", () => {
    render(
      <CompletenessBar
        completeness={{
          mandatoryTotal: 22,
          filled: 18,
          accepted: 12,
          pendingReview: 6,
          unknown: 4,
        }}
      />,
    );
    expect(screen.getByText("18/22")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Completeness: 12 accepted, 6 pending review or approval, 4 unknown, of 22 mandatory attributes.",
      }),
    ).toBeInTheDocument();
  });

  it("does not divide by zero when mandatoryTotal is 0", () => {
    render(
      <CompletenessBar
        completeness={{ mandatoryTotal: 0, filled: 0, accepted: 0, pendingReview: 0, unknown: 0 }}
      />,
    );
    expect(screen.getByText("0/0")).toBeInTheDocument();
  });
});
