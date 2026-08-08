# ADR-0010 — Export behind an adapter interface; CX1 as one target
Status: Accepted
Date: 2026-08-07

## Context
Demonstrating integration with the target platform (CX1) is a major judging factor. However, the
platform's actual import schema, field names, and taxonomy handling are **not reliably known to us at
planning time** (see risk R13). Designing directly against a guessed schema risks a late invalidation
of significant work.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Build directly against a guessed CX1 schema | Maximum apparent integration | If the guess is wrong, the work is discarded late and publicly |
| Generic CSV export only | Safe | Weak integration story; misses a major judging criterion |
| **`ExportTarget` port with CSV/JSON/XLSX + a CX1 adapter fed by a mapping config** | Integration story preserved; a wrong guess costs a config file, not a rewrite | Slight indirection |

## Decision
Exports go through an `ExportTarget` port. Generic CSV/JSON/XLSX adapters ship first. The CX1 adapter
is a **field-mapping configuration** over the generic export, not bespoke code. A Week-1 research
task establishes the real schema; findings update the mapping, not the architecture.

## Consequences
**Easier:** a second export target is a config file; the integration demo is safe against incorrect
assumptions; the same mechanism serves marketplace feeds later.
**Harder:** slightly less "native" than a purpose-built integration.
**Accepted:** the risk asymmetry is decisive — being wrong about the schema costs hours instead of days.

## Revisit when
The real CX1 schema requires transformations the mapping layer cannot express (nested structures,
multi-record fan-out), at which point a dedicated adapter implementation is justified.

## Open item
**Week-1 research task:** obtain CX1 import schema/API documentation, or ask the organisers directly.
Record findings here and in `api.md`.
