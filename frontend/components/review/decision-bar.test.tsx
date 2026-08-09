import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecisionBar, type ReviewDialogKind } from "./decision-bar";
import { ShortcutRegistryProvider } from "@/lib/keyboard/registry";
import type { AttributeValue } from "@/lib/contracts/attribute-value";
import type { ReviewTask } from "@/lib/contracts/review";

// Focused on decision-bar's own action-availability and keyboard-dispatch logic — the
// dialogs it opens are exercised in their own component tests, so they're stubbed here
// to a minimal shape (matches why-panel.test.tsx's convention of mocking heavy children).
vi.mock("./edit-value-dialog", () => ({
  EditValueDialog: ({
    open,
    onSubmit,
  }: {
    open: boolean;
    onSubmit: (v: string, r: string) => void;
  }) =>
    open ? (
      <button onClick={() => onSubmit("PTFE", "manual correction")}>submit-edit</button>
    ) : null,
}));
vi.mock("./reattach-evidence-dialog", () => ({
  ReattachEvidenceDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reattach-dialog-open" /> : null,
}));
vi.mock("./bulk-dialog", () => ({
  BulkDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: (a: "accept" | "reject") => void;
  }) => (open ? <button onClick={() => onConfirm("accept")}>confirm-bulk</button> : null),
}));

const assertedValue: AttributeValue = {
  id: "av_1",
  attribute: {
    code: "seat_material",
    name: "Seat Material",
    datatype: "enum",
    riskTier: 1,
    isMandatory: true,
  },
  status: "NEEDS_REVIEW",
  valueDisplay: "PTFE",
  valueCanonical: null,
  valueRaw: "PTFE",
  provenanceKind: "EXTRACTED",
  confidence: 0.42,
  evidence: [
    {
      documentVersionId: "docver_1",
      page: 2,
      regionId: "docver_1/table1/row15/spec",
      charStart: 0,
      charEnd: 4,
      snippetText: "PTFE",
      bbox: [10, 20, 30, 40],
    },
  ],
  verification: {
    verdict: "NOT_ENTAILED",
    deterministicCheck: "fail",
    rationale: "Span belongs to a different row.",
    verifierModel: "verifier-v1",
  },
  createdAt: "2026-08-01T00:00:00.000Z",
};

function baseTask(overrides: Partial<ReviewTask> = {}): ReviewTask {
  return {
    id: "task_1",
    recordId: "rec_1",
    recordMpn: "ABC-123",
    recordDescription: "1/2 BRS BALL VLV 600WOG",
    attributeValueId: "av_1",
    attributeCode: "seat_material",
    attributeName: "Seat Material",
    riskTier: 1,
    reasonCode: "VERIFICATION_FAILED",
    state: "open",
    priority: 0,
    assignedTo: null,
    proposedValue: assertedValue,
    rejectionReason: "Span belongs to a different row.",
    documentVersionId: "docver_1",
    page: 2,
    similarTaskCount: 3,
    openedAt: "2026-08-01T00:00:00.000Z",
    closedAt: null,
    ...overrides,
  };
}

function Harness({
  task,
  similarTaskCount = 0,
  handlers,
}: {
  task: ReviewTask;
  similarTaskCount?: number;
  handlers: {
    onAccept: () => void;
    onApprove: () => void;
    onReject: (r: string) => void;
    onUnknown: (r: string) => void;
    onCorrect: (v: string, r: string) => void;
    onSkip: () => void;
    onBulk: (a: "accept" | "reject") => void;
  };
}) {
  const [activeDialog, setActiveDialog] = useState<ReviewDialogKind>(null);
  return (
    <ShortcutRegistryProvider>
      <DecisionBar
        task={task}
        similarTaskCount={similarTaskCount}
        activeDialog={activeDialog}
        onActiveDialogChange={setActiveDialog}
        {...handlers}
      />
    </ShortcutRegistryProvider>
  );
}

function handlerSet() {
  return {
    onAccept: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onUnknown: vi.fn(),
    onCorrect: vi.fn(),
    onSkip: vi.fn(),
    onBulk: vi.fn(),
  };
}

describe("DecisionBar — Tier 0 (INV-9)", () => {
  it("offers Approve, never Accept, for a Tier 0 task — and 'A' calls onApprove, not onAccept", async () => {
    const handlers = handlerSet();
    render(<Harness task={baseTask({ riskTier: 0 })} handlers={handlers} />);

    expect(screen.getByRole("button", { name: "[A] Approve" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "[A] Accept" })).not.toBeInTheDocument();

    await userEvent.keyboard("a");
    expect(handlers.onApprove).toHaveBeenCalledTimes(1);
    expect(handlers.onAccept).not.toHaveBeenCalled();
  });
});

describe("DecisionBar — Accept/Reject vs Unknown, gated on a proposed value", () => {
  it("shows Accept + Reject when a proposed value exists; 'r' rejects, not marks Unknown", async () => {
    const handlers = handlerSet();
    render(<Harness task={baseTask()} handlers={handlers} />);

    expect(screen.getByRole("button", { name: "[A] Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "[R] Reject → Unknown" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "[U] Mark Unknown" })).not.toBeInTheDocument();

    await userEvent.keyboard("r");
    expect(handlers.onReject).toHaveBeenCalledWith("VERIFICATION_FAILED");
    expect(handlers.onUnknown).not.toHaveBeenCalled();
  });

  it("shows Mark Unknown, not Reject, when there is no proposed value", async () => {
    const handlers = handlerSet();
    render(
      <Harness
        task={baseTask({ proposedValue: null, reasonCode: "NO_DOCUMENT" })}
        handlers={handlers}
      />,
    );

    expect(screen.queryByRole("button", { name: "[R] Reject → Unknown" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "[U] Mark Unknown" })).toBeInTheDocument();

    await userEvent.keyboard("u");
    expect(handlers.onUnknown).toHaveBeenCalledWith("NO_DOCUMENT_FOUND");
    expect(handlers.onReject).not.toHaveBeenCalled();
  });
});

describe("DecisionBar — Reattach and Bulk are gated on availability", () => {
  it("disables Reattach when the task has no bound document", () => {
    render(<Harness task={baseTask({ documentVersionId: null })} handlers={handlerSet()} />);
    expect(screen.getByRole("button", { name: "[D] Reattach" })).toBeDisabled();
  });

  it("disables Bulk when there are no similar tasks", () => {
    render(<Harness task={baseTask()} similarTaskCount={0} handlers={handlerSet()} />);
    expect(screen.getByRole("button", { name: "[B] Bulk" })).toBeDisabled();
  });

  it("enables Bulk and shows the count when similar tasks exist", async () => {
    const handlers = handlerSet();
    render(<Harness task={baseTask()} similarTaskCount={4} handlers={handlers} />);
    const bulkButton = screen.getByRole("button", { name: "[B] Bulk (4)" });
    expect(bulkButton).toBeEnabled();
    await userEvent.click(bulkButton);
    await userEvent.click(screen.getByRole("button", { name: "confirm-bulk" }));
    expect(handlers.onBulk).toHaveBeenCalledWith("accept");
  });
});

describe("DecisionBar — Skip and Edit", () => {
  it("'s' calls onSkip without opening any dialog", async () => {
    const handlers = handlerSet();
    render(<Harness task={baseTask()} handlers={handlers} />);
    await userEvent.keyboard("s");
    expect(handlers.onSkip).toHaveBeenCalledTimes(1);
  });

  it("Edit opens a dialog whose submission calls onCorrect", async () => {
    const handlers = handlerSet();
    render(<Harness task={baseTask()} handlers={handlers} />);
    await userEvent.click(screen.getByRole("button", { name: "[E] Edit value" }));
    await userEvent.click(screen.getByRole("button", { name: "submit-edit" }));
    expect(handlers.onCorrect).toHaveBeenCalledWith("PTFE", "manual correction");
  });
});

describe("DecisionBar — a dialog owns the keyboard while open", () => {
  it("'a' does not fire Accept while the Edit dialog is open", async () => {
    const handlers = handlerSet();
    render(<Harness task={baseTask()} handlers={handlers} />);
    await userEvent.click(screen.getByRole("button", { name: "[E] Edit value" }));
    await userEvent.keyboard("a");
    expect(handlers.onAccept).not.toHaveBeenCalled();
  });
});
