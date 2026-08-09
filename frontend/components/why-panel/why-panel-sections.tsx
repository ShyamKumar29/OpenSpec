/**
 * The six sections of the Why panel (docs/06-frontend.md §3.2): Evidence · Verification
 * · Validation · Normalisation · Confidence · Policy. Every field rendered here comes
 * from `AttributeExplain` (`GET /attributes/{id}/explain`) — nothing is narrated or
 * invented; `rationale` is the one model-authored string anywhere and it's rendered
 * exactly as stored, through `SnippetText` (INV-7). The Unknown variant renders the same
 * six sections with the same components — Evidence explains absence instead of a
 * citation, Verification/Normalisation/Confidence explain why they don't apply, and
 * Validation/Policy are unchanged (FR-EXP-3).
 */
import { CheckCircle2, XCircle } from "lucide-react";
import { SnippetText } from "@/components/attribute/snippet-text";
import { ConfidenceIndicator } from "@/components/attribute/confidence-indicator";
import { UnknownValue } from "@/components/attribute/unknown-value";
import { Button } from "@/components/ui/button";
import { formatConfidence } from "@/lib/format/confidence";
import type {
  AttributeValue,
  AttributeValueAsserted,
  Verification,
} from "@/lib/contracts/attribute-value";
import type {
  ConfidenceSignals,
  ExplainEvidence,
  Policy,
  TransformStep,
  ValidationRule,
} from "@/lib/contracts/explain";
import { cn } from "@/lib/utils";

export function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("flex flex-col gap-1.5 border-t pt-3 first:border-t-0 first:pt-0", className)}
    >
      <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

const VERDICT_GLYPH: Record<Verification["verdict"], { glyph: string; tone: string }> = {
  ENTAILED: { glyph: "✓", tone: "text-status-accepted" },
  PARTIAL: { glyph: "◐", tone: "text-status-needs-review" },
  NOT_ENTAILED: { glyph: "✕", tone: "text-status-rejected" },
};

export function EvidenceSection({
  value,
  evidence,
  activeEvidenceId,
  onShowOnPage,
}: {
  value: AttributeValue;
  evidence: ExplainEvidence[];
  activeEvidenceId: string | null;
  onShowOnPage: (regionId: string) => void;
}) {
  if (value.status === "UNKNOWN") {
    return (
      <Section title="Evidence">
        <UnknownValue reason={value.unknownReason} />
      </Section>
    );
  }

  if (evidence.length === 0) {
    return (
      <Section title="Evidence">
        <p className="text-muted-foreground text-xs">
          No evidence is recorded for this value — this would itself be a contract violation
          (INV-1); if you see this, something upstream is inconsistent.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Evidence">
      <div className="flex flex-col gap-3">
        {evidence.map((e, i) => (
          <dl
            key={e.regionId}
            className={cn(
              "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md px-2 py-1.5 text-xs",
              // A tinted background here would recompute contrast for every `text-*`
              // token inside it against a non-`--background` colour (NFR-ACC-3's trap,
              // one level removed) — a border accent on the existing muted fill avoids
              // that recalculation entirely while still marking which citation is active.
              e.regionId === activeEvidenceId
                ? "bg-muted/60 border-status-needs-approval border-l-2"
                : "",
            )}
          >
            <dt className="text-muted-foreground">Document</dt>
            <dd className="truncate">
              <SnippetText text={e.documentTitle ?? "Unknown document"} />
            </dd>
            <dt className="text-muted-foreground">Location</dt>
            <dd className="metric">
              page {e.page} · {e.regionId.split("/").slice(1).join(" · ")}
            </dd>
            <dt className="text-muted-foreground">Verbatim</dt>
            <dd>
              <SnippetText text={e.snippetText} className="font-mono" />
            </dd>
            {e.contextShown ? (
              <>
                <dt className="text-muted-foreground self-start">Context</dt>
                <dd className="text-muted-foreground flex flex-col gap-0.5">
                  {e.contextShown.columnHeader ? (
                    <span>
                      Column header: <SnippetText text={e.contextShown.columnHeader} />
                    </span>
                  ) : null}
                  {e.contextShown.tableCaption ? (
                    <span>
                      Table caption: <SnippetText text={e.contextShown.tableCaption} />
                    </span>
                  ) : null}
                </dd>
              </>
            ) : null}
            <dt />
            <dd>
              <Button
                variant="link"
                size="xs"
                className="h-auto px-0 text-xs"
                onClick={() => onShowOnPage(e.regionId)}
              >
                show on page ▸
                {evidence.length > 1 ? ` (citation ${i + 1} of ${evidence.length})` : ""}
              </Button>
            </dd>
          </dl>
        ))}
      </div>
    </Section>
  );
}

export function VerificationSection({ verification }: { verification: Verification | null }) {
  return (
    <Section title="Verification">
      {verification ? (
        <>
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              VERDICT_GLYPH[verification.verdict].tone,
            )}
          >
            <span aria-hidden="true">{VERDICT_GLYPH[verification.verdict].glyph}</span>
            {verification.verdict}
            <span className="text-muted-foreground font-normal">
              · {verification.deterministicCheck} match · verifier: {verification.verifierModel}
            </span>
          </p>
          <p className="text-muted-foreground text-xs">
            <SnippetText text={verification.rationale} />
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">
          Not applicable — no value was asserted, so there is nothing to independently verify
          (INV-2).
        </p>
      )}
    </Section>
  );
}

export function ValidationSection({ rules }: { rules: ValidationRule[] }) {
  return (
    <Section title="Validation">
      {rules.length === 0 ? (
        <p className="text-muted-foreground text-xs">No validation rules were evaluated.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rules.map((rule) => (
            <li key={rule.ruleId} className="flex items-start gap-1.5 text-xs">
              {rule.passed ? (
                <CheckCircle2
                  className="text-status-accepted mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <XCircle
                  className="text-status-rejected mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>
                <span className="metric font-medium">{rule.ruleId}</span>{" "}
                <span className="text-muted-foreground">
                  <SnippetText text={rule.description} />
                </span>
                <span className="sr-only">{rule.passed ? " — passed" : " — failed"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function NormalisationSection({ steps }: { steps: TransformStep[] }) {
  return (
    <Section title="Normalisation">
      {steps.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No transform chain — no value was asserted to normalise.
        </p>
      ) : (
        <ol className="flex flex-col gap-1 text-xs">
          {steps.map((step) => {
            // A step whose output equals its input (or has none) documents *that a rule
            // ran*, not a change — render it once rather than as a no-op "X → X" (which
            // would also duplicate the Evidence section's verbatim text for no reason).
            const changed = step.outputValue !== null && step.outputValue !== step.inputValue;
            return (
              <li key={step.seq} className="flex gap-2">
                <span className="metric text-muted-foreground">{step.seq}</span>
                <span>
                  <span className="metric">{step.ruleId}</span>{" "}
                  <SnippetText text={step.inputValue} className="font-mono" />
                  {changed ? (
                    <>
                      {" → "}
                      <SnippetText text={step.outputValue!} className="font-mono" />
                    </>
                  ) : null}
                  <span className="text-muted-foreground"> — {step.note}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

export function ConfidenceSection({
  value,
  signals,
}: {
  value: AttributeValueAsserted | null;
  signals: ConfidenceSignals | null;
}) {
  return (
    <Section title="Confidence">
      {value && signals ? (
        <>
          <div className="flex items-center justify-between">
            <ConfidenceIndicator value={value.confidence} provenance={value.provenanceKind} />
          </div>
          {/* Not a <dl>: each entry is one "label value" phrase, not a separate
              term/definition pair, so <dl> would be the wrong (and, per axe's
              definition-list rule, invalid) structure for it. */}
          <div className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            <span>doc binding {formatConfidence(signals.documentBindingConfidence)}</span>
            <span>row binding {formatConfidence(signals.rowBindingConfidence)}</span>
            <span>parse {formatConfidence(signals.parseQuality)}</span>
            <span>span {signals.spanContainment}</span>
            <span>verification {signals.verificationVerdict}</span>
            <span>validation {signals.validationResult}</span>
            <span>provenance {signals.provenanceKind ?? "—"}</span>
            <span>attribute prior {formatConfidence(signals.attributeHistoricalPrecision)}</span>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">
          No confidence score — confidence is only computed for an asserted value, never
          self-reported by a model (CLAUDE.md).
        </p>
      )}
    </Section>
  );
}

export function PolicySection({ policy }: { policy: Policy }) {
  return (
    <Section title="Policy">
      <p className="text-xs">
        {policy.tier === 0 ? (
          <span className="text-status-needs-approval font-medium">Tier 0. </span>
        ) : (
          <span className="text-muted-foreground font-medium">Tier {policy.tier}. </span>
        )}
        <SnippetText text={policy.note} className="text-muted-foreground" />
      </p>
    </Section>
  );
}
