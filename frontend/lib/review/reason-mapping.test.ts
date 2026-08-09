import { describe, expect, it } from "vitest";
import { unknownReasonForTask } from "./reason-mapping";
import { REVIEW_REASON_CODES } from "@/lib/contracts/review";
import { UNKNOWN_REASONS } from "@/lib/contracts/attribute-value";

describe("unknownReasonForTask", () => {
  it("maps every review reason code to a valid, closed UnknownReason", () => {
    for (const code of REVIEW_REASON_CODES) {
      expect(UNKNOWN_REASONS).toContain(unknownReasonForTask(code));
    }
  });

  it("maps the queue tabs to their documented natural reasons", () => {
    expect(unknownReasonForTask("NO_DOCUMENT")).toBe("NO_DOCUMENT_FOUND");
    expect(unknownReasonForTask("AMBIGUOUS")).toBe("AMBIGUOUS_CANDIDATES");
    expect(unknownReasonForTask("CONFLICTING")).toBe("CONFLICTING_SOURCES");
    expect(unknownReasonForTask("VERIFICATION_FAILED")).toBe("VERIFICATION_FAILED");
  });
});
