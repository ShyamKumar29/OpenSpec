import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveResultPanel, type LiveResultPanelProps } from "./live-result-panel";
import type { AttributeValue } from "@/lib/contracts/attribute-value";
import type { Run } from "@/lib/contracts/run";

const useRecordDetailQueryMock = vi.fn();
vi.mock("@/lib/queries/records", () => ({
  useRecordDetailQuery: (...args: unknown[]) => useRecordDetailQueryMock(...args),
}));

function pressureAttr(): AttributeValue {
  return {
    id: "av_wog",
    attribute: {
      code: "pressure_rating_wog",
      name: "Pressure Rating (WOG)",
      datatype: "pressure",
      riskTier: 0,
      isMandatory: true,
    },
    status: "NEEDS_APPROVAL",
    valueDisplay: "600 psi",
    valueCanonical: { magnitude: 600, unit: "psi", media: "WOG" },
    valueRaw: "600 WOG",
    provenanceKind: "EXTRACTED",
    confidence: 0.97,
    evidence: [
      {
        documentVersionId: "docver_apollo_70_100_v2024",
        page: 2,
        regionId: "docver_apollo_70_100_v2024/table1/row14",
        charStart: 0,
        charEnd: 7,
        snippetText: "600 WOG",
        bbox: [312, 480, 372, 494],
      },
    ],
    verification: {
      verdict: "ENTAILED",
      deterministicCheck: "exact",
      rationale: "Row bound to catalog no. 70-104-01, matching ABC-123.",
      verifierModel: "verifier-v1",
    },
    createdAt: "2026-08-07T09:12:03Z",
  };
}

function baseRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "judge_run_success",
    kind: "judge",
    status: "completed",
    recordId: "rec_canonical_abc123",
    mpn: "ABC-123",
    stages: [],
    liveExtracted: 16,
    liveUnknown: 6,
    liveRejected: 0,
    costUsd: 0.055,
    tokensIn: 18400,
    tokensOut: 3100,
    startedAt: "2026-08-09T00:00:00Z",
    finishedAt: "2026-08-09T00:00:06Z",
    ...overrides,
  };
}

const baseProps: LiveResultPanelProps = {
  phase: "completed",
  run: baseRun(),
  totals: { liveExtracted: 16, liveUnknown: 6, liveRejected: 0 },
  elapsedMs: 5900,
  costSoFar: 0.055,
  onRunAgain: vi.fn(),
};

beforeEach(() => {
  useRecordDetailQueryMock.mockReset();
});

describe("LiveResultPanel — headline framing", () => {
  it("frames a clean success", () => {
    useRecordDetailQueryMock.mockReturnValue({ status: "pending", data: undefined });
    render(<LiveResultPanel {...baseProps} />);
    expect(screen.getByText(/Run complete — 16 extracted, 6 unknown/)).toBeInTheDocument();
  });

  it("frames a run with a rejected value distinctly from a clean success", () => {
    useRecordDetailQueryMock.mockReturnValue({ status: "pending", data: undefined });
    render(
      <LiveResultPanel
        {...baseProps}
        totals={{ liveExtracted: 15, liveUnknown: 6, liveRejected: 1 }}
      />,
    );
    expect(
      screen.getByText(/1 value rejected by verification, held for review/),
    ).toBeInTheDocument();
  });

  it("frames a full abstain distinctly, with no catalog record to open", () => {
    render(
      <LiveResultPanel
        {...baseProps}
        run={baseRun({ id: "judge_run_abstain", recordId: null, mpn: "XYZ-9001" })}
        totals={{ liveExtracted: 0, liveUnknown: 17, liveRejected: 0 }}
      />,
    );
    expect(screen.getByText(/abstained on every attribute/)).toBeInTheDocument();
    expect(screen.getByText(/isolated from catalog data/)).toBeInTheDocument();
    expect(useRecordDetailQueryMock).not.toHaveBeenCalled();
  });

  it("frames cancelled, failed, and timed-out distinctly and offers the cached fallback on both failure paths", () => {
    const { rerender } = render(<LiveResultPanel {...baseProps} phase="cancelled" />);
    expect(screen.getByText("Run cancelled")).toBeInTheDocument();

    rerender(<LiveResultPanel {...baseProps} phase="failed" onUseCachedFallback={vi.fn()} />);
    expect(screen.getByText("Run failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load cached demo result" })).toBeInTheDocument();

    rerender(<LiveResultPanel {...baseProps} phase="timed_out" onUseCachedFallback={vi.fn()} />);
    expect(screen.getByText(/exceeded its time budget/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load cached demo result" })).toBeInTheDocument();
  });
});

describe("LiveResultPanel — hand-off into the real record (F1/F3 reuse)", () => {
  it("renders the hero attributes via the real AttributeRow, not a parallel result shape", () => {
    useRecordDetailQueryMock.mockReturnValue({
      status: "success",
      data: { mpnRaw: "ABC-123", attributes: [pressureAttr()] },
    });
    render(<LiveResultPanel {...baseProps} />);
    expect(screen.getByTestId("attribute-row")).toHaveTextContent("Pressure Rating (WOG)");
    expect(screen.getByRole("link", { name: /Open full record \(ABC-123\)/ })).toHaveAttribute(
      "href",
      "/catalog/rec_canonical_abc123",
    );
  });

  it("shows a loading block while the record is being fetched", () => {
    useRecordDetailQueryMock.mockReturnValue({ status: "pending", data: undefined });
    render(<LiveResultPanel {...baseProps} />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});

describe("LiveResultPanel — actions", () => {
  it("calls onRunAgain and the cached-fallback handler", async () => {
    useRecordDetailQueryMock.mockReturnValue({ status: "pending", data: undefined });
    const onRunAgain = vi.fn();
    const onUseCachedFallback = vi.fn();
    render(
      <LiveResultPanel
        {...baseProps}
        phase="failed"
        onRunAgain={onRunAgain}
        onUseCachedFallback={onUseCachedFallback}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Run again" }));
    expect(onRunAgain).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Load cached demo result" }));
    expect(onUseCachedFallback).toHaveBeenCalled();
  });

  it("links to the run monitor unless hideRunMonitorLink is set", () => {
    useRecordDetailQueryMock.mockReturnValue({ status: "pending", data: undefined });
    const { rerender } = render(<LiveResultPanel {...baseProps} />);
    expect(screen.getByRole("link", { name: /View in Run Monitor/ })).toBeInTheDocument();

    rerender(<LiveResultPanel {...baseProps} hideRunMonitorLink />);
    expect(screen.queryByRole("link", { name: /View in Run Monitor/ })).not.toBeInTheDocument();
  });
});
