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
  /** Present-tense operation token used by the Judge Mode engine console's activity log
   *  (`lib/run-events/engine-log.ts`) — "EXTRACTING", not "Extract". Same vocabulary as
   *  `label`, conjugated: the timeline names the stage, the console narrates what it is
   *  doing right now. */
  verb: string;
}

export const STAGE_COPY: Record<StageCode, StageCopy> = {
  CLS: {
    code: "CLS",
    label: "Classify",
    description: "Resolve the taxonomy class",
    verb: "CLASSIFYING",
  },
  SCH: {
    code: "SCH",
    label: "Schema",
    description: "Resolve the mandatory attribute set",
    verb: "RESOLVING_SCHEMA",
  },
  DOC: {
    code: "DOC",
    label: "Document binding",
    description: "Find and bind the source document",
    verb: "BINDING_DOCUMENT",
  },
  PRS: {
    code: "PRS",
    label: "Parse",
    description: "Parse the bound document (cached by content hash)",
    verb: "PARSING",
  },
  EXT: {
    code: "EXT",
    label: "Extract",
    description: "Grounded, per-attribute extraction",
    verb: "EXTRACTING",
  },
  VER: {
    code: "VER",
    label: "Verify",
    description: "Independent entailment check per candidate",
    verb: "VERIFYING",
  },
  VAL: {
    code: "VAL",
    label: "Validate",
    description: "Deterministic rules — type, range, cross-field",
    verb: "VALIDATING",
  },
  NRM: {
    code: "NRM",
    label: "Normalise",
    description: "Canonical form, with a full transform trace",
    verb: "NORMALISING",
  },
  CNF: {
    code: "CNF",
    label: "Confidence",
    description: "Composite scoring and tier routing",
    verb: "SCORING_CONFIDENCE",
  },
};
