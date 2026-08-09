import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhyPanelTrigger } from "./why-panel";
import { isUnknownValue, type AttributeValue } from "@/lib/contracts/attribute-value";
import type { AttributeExplain } from "@/lib/contracts/explain";

const useAttributeExplainQueryMock = vi.fn();
vi.mock("@/lib/queries/attributes", () => ({
  useAttributeExplainQuery: (...args: unknown[]) => useAttributeExplainQueryMock(...args),
}));

const useDocumentQueryMock = vi.fn();
const useDocumentRegionsQueryMock = vi.fn();
vi.mock("@/lib/queries/documents", () => ({
  useDocumentQuery: (...args: unknown[]) => useDocumentQueryMock(...args),
  useDocumentRegionsQuery: (...args: unknown[]) => useDocumentRegionsQueryMock(...args),
}));

const assertedValue: AttributeValue = {
  id: "av_1",
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

const unknownValue: AttributeValue = {
  id: "av_2",
  attribute: {
    code: "ansi_class",
    name: "ANSI Class",
    datatype: "enum",
    riskTier: 1,
    isMandatory: true,
  },
  status: "UNKNOWN",
  unknownReason: "ATTRIBUTE_NOT_IN_DOCUMENT",
  createdAt: "2026-08-07T09:12:03Z",
};

function explainFor(value: AttributeValue): AttributeExplain {
  const isUnknown = isUnknownValue(value);
  return {
    attributeValue: value,
    evidence: isUnknown
      ? []
      : value.evidence.map((e) => ({
          ...e,
          documentTitle: "Apollo 70-100 Series Bronze Ball Valves",
          contextShown: {
            columnHeader: "Pressure Rating (WOG)",
            tableCaption: "Apollo 70-100 Series",
          },
        })),
    verification: isUnknown ? null : value.verification,
    validation: isUnknown
      ? [
          {
            ruleId: "NRM-17",
            description: "ANSI Class is never derived from a WOG rating",
            passed: true,
          },
        ]
      : [{ ruleId: "PRS-004", description: "range for brass/bronze body", passed: true }],
    transformChain: isUnknown
      ? []
      : [
          {
            seq: 1,
            ruleId: "PARSE-001",
            inputValue: "600 WOG",
            outputValue: "600 WOG",
            note: "parsed",
          },
        ],
    confidenceSignals: isUnknown
      ? null
      : {
          documentBindingConfidence: 0.98,
          rowBindingConfidence: 0.98,
          parseQuality: 0.98,
          spanContainment: "exact",
          verificationVerdict: "ENTAILED",
          validationResult: "pass",
          provenanceKind: "EXTRACTED",
          classConfidence: 0.97,
          attributeHistoricalPrecision: 0.96,
        },
    policy: isUnknown
      ? {
          tier: 1,
          note: "Standard risk tier — eligible for auto-accept above the configured threshold.",
        }
      : { tier: 0, note: "Tier 0 — human approval required regardless of confidence (INV-9)." },
    status: value.status,
  };
}

beforeEach(() => {
  useAttributeExplainQueryMock.mockReset();
  useDocumentQueryMock.mockReset();
  useDocumentRegionsQueryMock.mockReset();
  useDocumentQueryMock.mockReturnValue({
    status: "pending",
    data: undefined,
    error: null,
    refetch: vi.fn(),
  });
  useDocumentRegionsQueryMock.mockReturnValue({
    status: "success",
    data: [],
    error: null,
    refetch: vi.fn(),
  });
});

describe("WhyPanelTrigger", () => {
  it("does not fetch explain data until opened (lazy)", () => {
    useAttributeExplainQueryMock.mockReturnValue({
      status: "pending",
      data: undefined,
      error: null,
      refetch: vi.fn(),
    });
    render(<WhyPanelTrigger value={assertedValue} />);
    expect(useAttributeExplainQueryMock).not.toHaveBeenCalled();
  });

  it("renders Evidence, Verification, Validation, Normalisation, Confidence, and Policy for an asserted value", async () => {
    useAttributeExplainQueryMock.mockReturnValue({
      status: "success",
      data: explainFor(assertedValue),
      error: null,
      refetch: vi.fn(),
    });
    render(<WhyPanelTrigger value={assertedValue} />);

    await userEvent.click(screen.getByRole("button", { name: "[why?]" }));

    const evidenceSection = screen.getByRole("heading", { name: "Evidence" }).closest("section")!;
    const verificationSection = screen
      .getByRole("heading", { name: "Verification" })
      .closest("section")!;
    expect(screen.getByRole("heading", { name: "Validation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Normalisation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confidence" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Policy" })).toBeInTheDocument();

    // "600 WOG" and "ENTAILED" each legitimately appear more than once across the panel
    // (the raw verbatim citation vs. the normalisation chain's input; the verification
    // verdict vs. its echo in the confidence signal vector) — scoped to the section that
    // owns the claim, per docs/06-frontend.md §3.2.
    expect(within(evidenceSection).getByText("600 WOG", { exact: true })).toBeInTheDocument();
    expect(within(verificationSection).getByText("ENTAILED", { exact: false })).toBeInTheDocument();
    expect(
      within(verificationSection).getByText(
        /Row bound to catalog no\. 70-104-01, matching ABC-123/,
      ),
    ).toBeInTheDocument();
  });

  it("renders the Unknown variant with the same six sections — Evidence explains absence, Validation still shows NRM-17 (FR-EXP-3)", async () => {
    useAttributeExplainQueryMock.mockReturnValue({
      status: "success",
      data: explainFor(unknownValue),
      error: null,
      refetch: vi.fn(),
    });
    render(<WhyPanelTrigger value={unknownValue} />);

    await userEvent.click(screen.getByRole("button", { name: "[why?]" }));

    const evidenceSection = screen.getByRole("heading", { name: "Evidence" }).closest("section")!;
    expect(within(evidenceSection).getByText("Not stated in the document")).toBeInTheDocument();

    const validationSection = screen
      .getByRole("heading", { name: "Validation" })
      .closest("section")!;
    expect(within(validationSection).getByText("NRM-17")).toBeInTheDocument();
    expect(
      within(validationSection).getByText(/never derived from a WOG rating/),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/no value was asserted, so there is nothing to independently verify/),
    ).toBeInTheDocument();
    expect(screen.getByText(/No confidence score/)).toBeInTheDocument();
  });

  it("shows a loading state, then the panel, without ever showing a value-less citation (INV-1)", () => {
    useAttributeExplainQueryMock.mockReturnValue({
      status: "pending",
      data: undefined,
      error: null,
      refetch: vi.fn(),
    });
    render(<WhyPanelTrigger value={assertedValue} />);
    fireEvent.click(screen.getByRole("button", { name: "[why?]" }));
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows an error state with retry when explain fails to load", async () => {
    const refetch = vi.fn();
    useAttributeExplainQueryMock.mockReturnValue({
      status: "error",
      data: undefined,
      error: new Error("network down"),
      refetch,
    });
    render(<WhyPanelTrigger value={assertedValue} />);
    await userEvent.click(screen.getByRole("button", { name: "[why?]" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
