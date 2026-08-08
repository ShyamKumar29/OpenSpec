# ADR-0011 — Hand-authored taxonomy subset, ETIM-compatible in shape
Status: Accepted
Date: 2026-08-07

## Context
The system needs an authoritative definition of which attributes are mandatory per product class,
with datatypes, units, and allowed values. ETIM is the industrial standard and would supply all of
this — but its licensing and access terms are unresolved at planning time, and resolving them is not
on our critical path.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Adopt ETIM directly | Free ground truth; instant industry credibility; channel-partner compatible | Licensing/access unresolved; potential blocker on the critical path; large data import |
| UNSPSC only | Freely available | Classification-only — **no attribute definitions**, which is the part we actually need |
| Invent a bespoke taxonomy | Full control | Weeks of work; no external credibility; the classic hackathon rabbit hole |
| **Hand-author a subset for 5 classes, structurally ETIM-compatible** | ~1 day of work; full control; maps cleanly to ETIM later | Not standards-certified; smaller scope |

## Decision
Hand-author attribute schemas for the 5 PVF demo classes as versioned YAML in
`backend/resources/taxonomy/`, using an **ETIM-shaped structure** (class → features with datatype,
unit, allowed values) and an `external_ref` field reserved for future ETIM/UNSPSC codes.

## Consequences
**Easier:** no external blocker; schemas are PR-reviewable; adding a sixth class is a YAML file with
zero code changes — a demonstrable claim.
**Harder:** we cannot claim standards compliance; a real deployment would need proper mapping.
**Accepted:** recorded as technical debt TD-4 with a clear repayment trigger, and stated honestly in
the pitch rather than glossed over.

## Revisit when
An ETIM licence is obtained, or a customer requires certified standards compliance. The
`external_ref` field and the ETIM-shaped structure make that migration a data import, not a redesign.
