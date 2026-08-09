/**
 * Stage labels — the narration vocabulary for the timeline (docs/06-frontend.md §3.4,
 * docs/02-architecture.md module codes). One place for the code -> name/description
 * mapping so the Judge Mode timeline and the `/runs/:id` monitor render identical copy.
 */
import type { StageCode } from "@/lib/contracts/run";

export interface StageCopy {
  code: StageCode;
  label: string;
  description: string;
}

export const STAGE_COPY: Record<StageCode, StageCopy> = {
  CLS: { code: "CLS", label: "Classify", description: "Resolve the taxonomy class" },
  SCH: { code: "SCH", label: "Schema", description: "Resolve the mandatory attribute set" },
  DOC: { code: "DOC", label: "Document binding", description: "Find and bind the source document" },
  PRS: {
    code: "PRS",
    label: "Parse",
    description: "Parse the bound document (cached by content hash)",
  },
  EXT: { code: "EXT", label: "Extract", description: "Grounded, per-attribute extraction" },
  VER: { code: "VER", label: "Verify", description: "Independent entailment check per candidate" },
  VAL: {
    code: "VAL",
    label: "Validate",
    description: "Deterministic rules — type, range, cross-field",
  },
  NRM: {
    code: "NRM",
    label: "Normalise",
    description: "Canonical form, with a full transform trace",
  },
  CNF: { code: "CNF", label: "Confidence", description: "Composite scoring and tier routing" },
};
