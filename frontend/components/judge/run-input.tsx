"use client";

/**
 * Judge Mode's entry form (docs/06-frontend.md §3.4): free-text MPN + description, an
 * optional PDF drop, and the three documented demo scenarios as one-click shortcuts
 * (docs/14-frontend-implementation-plan.md §4.2's "three canonical demo objects").
 *
 * Free text bypasses the scenario shortcuts entirely — it is sent with no `scenario`
 * field, so the mock's own fallback logic decides the outcome (docs/api.md §Judge Mode:
 * matches the canonical MPN, otherwise abstains). That is deliberate: it is what makes
 * "survives three unrehearsed inputs and one hostile input" (FR-JDG-1) true without this
 * component knowing anything about hostile-input handling — an unrecognised or adversarial
 * string just abstains, which is the product working, not a special case to code around.
 */
import { useId, useRef, useState } from "react";
import { FileTextIcon, PlayIcon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { JudgeRunInput } from "@/lib/queries/runs";

export interface JudgeScenarioCard {
  id: "success" | "abstain" | "rejected";
  label: string;
  mpn: string;
  description: string;
  blurb: string;
}

export const JUDGE_SCENARIO_CARDS: JudgeScenarioCard[] = [
  {
    id: "success",
    label: "Success",
    mpn: "ABC-123",
    description: "1/2 BRS BALL VLV 600WOG",
    blurb: "Full pipeline, verified end to end.",
  },
  {
    id: "abstain",
    label: "Evidence missing → Unknown",
    mpn: "XYZ-9001",
    description: "3/4 GATE VLV BRZ 150WOG",
    blurb: "No confident document match — abstains rather than guessing.",
  },
  {
    id: "rejected",
    label: "Proposed value rejected → review",
    mpn: "ABC-123",
    description: "1/2 BRS BALL VLV 600WOG",
    blurb: "Same record — verification catches a wrong-row binding.",
  },
];

export function RunInput({
  disabled = false,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (input: JudgeRunInput) => void;
}) {
  const [mpn, setMpn] = useState("");
  const [description, setDescription] = useState("");
  const [scenario, setScenario] = useState<JudgeScenarioCard["id"] | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mpnId = useId();
  const descriptionId = useId();

  const canSubmit = !disabled && (mpn.trim() !== "" || description.trim() !== "");

  function pickScenario(card: JudgeScenarioCard) {
    setScenario(card.id);
    setMpn(card.mpn);
    setDescription(card.description);
  }

  function editFreeText(setter: (v: string) => void, value: string) {
    // Any manual edit after picking a scenario detaches from that scenario — the
    // request goes out as free text (no `scenario` field), matching what the fields now
    // actually say, rather than silently keeping the customised value pinned to the
    // stale example the user started typing over.
    setScenario(null);
    setter(value);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      mpn: mpn.trim(),
      description: description.trim(),
      scenario: scenario ?? undefined,
      documentName,
    });
  }

  function acceptFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return;
    setDocumentName(file.name);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Run configuration">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Demo scenarios">
        {JUDGE_SCENARIO_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            aria-pressed={scenario === card.id}
            onClick={() => pickScenario(card)}
            disabled={disabled}
            className={cn(
              "border-border flex min-w-48 flex-1 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
              scenario === card.id
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50 bg-background",
            )}
          >
            <span className="text-foreground font-medium">{card.label}</span>
            {/* The selected card's `bg-primary/5` tint drops `text-muted-foreground`
             *  below the 4.5:1 contrast minimum (axe color-contrast) — `text-foreground/75`
             *  clears it comfortably while staying visually secondary to the label above. */}
            <span
              className={cn(
                "text-xs",
                scenario === card.id ? "text-foreground/75" : "text-muted-foreground",
              )}
            >
              {card.blurb}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <Label htmlFor={mpnId} className="text-muted-foreground text-[11px] font-normal">
            MPN
          </Label>
          <Input
            id={mpnId}
            value={mpn}
            onChange={(e) => editFreeText(setMpn, e.target.value)}
            placeholder="e.g. ABC-123"
            maxLength={120}
            disabled={disabled}
          />
        </div>
        <div className="flex min-w-56 flex-[2] flex-col gap-1">
          <Label htmlFor={descriptionId} className="text-muted-foreground text-[11px] font-normal">
            Description
          </Label>
          <Input
            id={descriptionId}
            value={description}
            onChange={(e) => editFreeText(setDescription, e.target.value)}
            placeholder="e.g. 1/2 BRS BALL VLV 600WOG"
            maxLength={240}
            disabled={disabled}
          />
        </div>
        <Button type="submit" disabled={!canSubmit}>
          <PlayIcon aria-hidden="true" />
          Run
        </Button>
      </div>

      {/* A `<label>` wrapping the (visually hidden) file input, not a `role="button"`
       *  div — the native input is the one real focusable/keyboard-operable control
       *  (Tab reaches it, Enter/Space opens the picker) instead of a hand-rolled
       *  keydown handler, and it stays a sibling of the remove button below rather than
       *  nesting one interactive control inside another (axe `nested-interactive`). Drag
       *  handlers live on the outer row so a drop anywhere in it counts. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) acceptFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "border-border flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors",
          disabled && "opacity-50",
          dragOver ? "border-primary bg-primary/5" : "hover:bg-muted/30",
        )}
      >
        <label
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5",
            disabled ? "pointer-events-none" : "cursor-pointer",
          )}
        >
          <span className="text-muted-foreground flex items-center gap-1.5">
            {documentName ? (
              <FileTextIcon className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <UploadIcon className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            {documentName ?? "Optional: drop a spec PDF here, or let us find one"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={disabled}
            aria-label="Attach a spec PDF"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
        </label>
        {documentName ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Remove attached document"
            disabled={disabled}
            onClick={() => {
              setDocumentName(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    </form>
  );
}
