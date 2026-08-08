# PVF Domain Reference

> **Audience:** everyone. This is the domain knowledge the system encodes.
> **Status:** authored from general industry knowledge for planning purposes.
> **⚠ Every rule below must be verified against primary sources (MSS SP-110, ASME B16 series,
> manufacturer catalogs) before it is implemented as a validation or normalisation rule.**
> A wrong rule here becomes a confident wrong answer in production.

---

## 1. Why PVF is the right wedge

| Property | Effect |
|---|---|
| Attribute-driven purchase decisions | Nothing sells without specs |
| Fitment is binary | A wrong end connection is a returned part and a lost customer |
| Safety and code relevance | Pressure, temperature, and potable-water compliance carry real liability |
| Extremely messy units | NPS/DN, WOG/WSP/Class, fractional inches — the hardest normalisation in industrial |
| Abundant free spec sheets | Corpus acquisition is tractable |
| Enormous long tail | Data pools don't cover it |

**The messy units are a feature for us**: they are where deterministic engineering visibly beats
naive AI, and they are what a domain-expert judge will probe.

---

## 2. Demo classes

| # | Class | Notes |
|---|---|---|
| 1 | Ball valves (bronze/brass) | Canonical case; richest attribute set |
| 2 | Gate / globe / check valves | Tests class discrimination — same abbreviations, different mandatory attributes |
| 3 | Pipe fittings (copper/brass, threaded & solder) | End-connection normalisation hell |
| 4 | PVC/CPVC valves & fittings | Different pressure regime (Sch 40/80, psi @ 73°F) — proves the engine isn't hardcoded |
| 5 | Pressure gauges / backflow preventers | Different document genre (submittal sheets with drawings) |

---

## 3. Ball valve attribute schema (illustrative, ~22 mandatory)

| Attribute | Type | Tier | Notes |
|---|---|---|---|
| `nominal_size` | designation | 1 | NPS or DN — **not a length** |
| `size_standard` | enum {NPS, DN, TUBE} | 1 | Must be explicit; refuse cross-standard comparison |
| `body_material` | enum | 1 | Brass, bronze, CI, ductile, CS, SS304/316, PVC, CPVC |
| `body_style` | enum | 2 | 1-piece / 2-piece / 3-piece |
| `end_connection_inlet` | enum | 1 | See §5 |
| `end_connection_outlet` | enum | 1 | Often differs from inlet |
| `port_type` | enum | 1 | Full / standard / reduced |
| `pressure_rating_wog` | pressure(psi, media=WOG) | **0** | Non-shock, ambient |
| `pressure_rating_wsp` | pressure(psi, media=WSP) | **0** | Saturated steam — a different basis |
| `ansi_class` | enum {125,150,300,600,…} | **0** | **Never derived from WOG** |
| `temperature_min` / `temperature_max` | temperature | **0** | Media- and seat-dependent |
| `seat_material` | enum | 2 | PTFE / RPTFE / PEEK / nylon |
| `stem_material` | enum | 2 | |
| `ball_material` | enum | 2 | Often chrome-plated brass or SS |
| `packing_material` | enum | 2 | |
| `handle_type` | enum | 3 | Lever / tee / oval / locking |
| `lead_free_compliance` | enum/bool | **0** | NSF/ANSI 372, SDWA — regulatory |
| `potable_water_listing` | enum | **0** | NSF/ANSI 61 |
| `blowout_proof_stem` | bool | 2 | |
| `iso_5211_mounting` | bool/enum | 2 | Actuation pad |
| `cv_flow_coefficient` | number | 2 | Size-dependent |
| `mss_sp_110_conformance` | bool | 1 | Industry conformance standard |

**Tier 0 = never auto-accepted (INV-9).** Six of twenty-two, which caps STP around 73%. That ceiling
is deliberate and is part of the pitch.

---

## 4. Size designations — trap #1

| Input | Correct interpretation | Wrong interpretation |
|---|---|---|
| `1/2` | **NPS 1/2** — a designation | 0.5 inches of anything |
| `1/2"` on a valve | Still NPS | Outside diameter |
| `DN15` | Metric designation, **equivalent to NPS 1/2** | 15 mm |
| `1/2 OD` on tube | **Tube size** — actually 0.5" OD | Same as NPS 1/2 |

**Rules:**
- `NominalSize` is its own value type with **no conversion method to a length.** There is no
  `.to_mm()` and there cannot be.
- NPS ↔ DN mapping is a **lookup table**, not arithmetic.
- NPS and TUBE sizes are **never comparable**. Cross-standard comparison returns `Unknown`.
- Fractions parse to exact `Fraction`: `1-1/4`, `1 1/4`, `1¼`, `1.25` → `Fraction(5,4)`.
  Display form preserved separately.

---

## 5. End connections — trap #2

| Canonical | Synonyms seen in the wild |
|---|---|
| `NPT_FEMALE` | FNPT, FIP, NPT-F, THRD-F, female threaded, IPS female |
| `NPT_MALE` | MNPT, MIP, NPT-M, male threaded |
| `SOLDER` | C×C, CxC, SWT, sweat, solder cup, copper socket |
| `PRESS` | ProPress, press-fit, press connect |
| `FLANGED` | FLG, ANSI flange, 150# flange |
| `GROOVED` | Victaulic-style, roll groove, cut groove |
| `BUTT_WELD` | BW |
| `SOCKET_WELD` | SW |
| `COMPRESSION` | comp, ferrule |
| `BARB` | insert, hose barb |
| `SOLVENT_WELD` | slip, socket (PVC context) |

**Rules:**
- Inlet and outlet are **separate attributes**. `1/2 FIP × 1/2 SWT` is a valid, common configuration.
- `FIP ≈ FNPT` is a trade convention, not an identity — mark such mappings `DERIVED`, not `EXTRACTED`.
- `socket` is ambiguous: copper socket (solder) vs PVC socket (solvent weld). **Resolve by material
  context; if material is unknown, return `Unknown(AMBIGUOUS_CANDIDATES)`.**

---

## 6. Pressure ratings — trap #3, the most dangerous

| Marking | Meaning |
|---|---|
| `600 WOG` | 600 psi Water/Oil/Gas, **non-shock, at ambient temperature** |
| `150 WSP` | 150 psi **Saturated Steam Pressure** — a different, much harsher basis |
| `600 CWP` | Cold Working Pressure — approximately WOG, but a distinct marking |
| `Class 150` | ASME B16 flange/valve class — a **temperature-dependent rating curve**, not a single psi |
| `PN16` | Metric nominal pressure (16 bar) |
| `235 psi @ 73°F` | PVC/CPVC convention — **temperature qualifier is mandatory** |

### The non-derivation rule (NRM-17) — the most important rule in the system

> **`ANSI Class` may NEVER be derived from a WOG rating, and vice versa.**
> They are different rating bases. Common valves marked `600 WOG` are frequently *also* `Class 150`,
> but the relationship is a manufacturer's design outcome, not a conversion. If the document does not
> state the class, the answer is `Unknown`.

**Why this matters more than any other rule:** it is the single most plausible-looking wrong answer
in the domain. An LLM will produce it confidently. A junior data analyst will produce it. It is the
demo beat that proves the product does something no competitor does.

**Additional rules:**
- WOG / WSP / CWP are **separate attributes**, never merged.
- `PressureRating` carries `media` in the type; there is no method to convert between media.
- Plastics ratings without a temperature qualifier are incomplete → `Unknown` or flagged.
- Validation: brass/bronze ball valve WOG typically ∈ [125, 1000] psi. Outside that range → review.

---

## 7. Materials & compliance

| Attribute | Notes |
|---|---|
| `body_material` | `BRS` = brass; `BRZ` = bronze; **they are different alloys, not synonyms** |
| Lead-free | NSF/ANSI 372 · SDWA weighted-average ≤0.25% Pb. Often a part-number suffix (`-LF`) — **that is `INFERRED`, not `EXTRACTED`**, and Tier 0, so it goes to a human regardless |
| Potable water | NSF/ANSI 61 — a distinct listing from 372 |
| Stainless | `SS304` vs `SS316` materially differ in corrosion resistance. Never generalise to "stainless" |
| PVC vs CPVC | Different temperature ratings. Never conflate |

---

## 8. Abbreviation dictionary (starter set — deterministic pre-pass)

| Abbrev | Expansion | | Abbrev | Expansion |
|---|---|---|---|---|
| `VLV` | valve | | `BRS` | brass |
| `BLV`, `BV` | ball valve | | `BRZ` | bronze |
| `GTV` | gate valve | | `SS` | stainless steel |
| `CKV` | check valve | | `CI` | cast iron |
| `GLB` | globe valve | | `DI` | ductile iron |
| `THRD` | threaded | | `CS` | carbon steel |
| `SWT` | solder / sweat | | `FP` | full port |
| `FLG` | flanged | | `SP` | standard port |
| `RED` | reducing | | `RP` | reduced port |
| `CPLG` | coupling | | `LF` | lead free |
| `ELL` | elbow | | `WOG` | water/oil/gas |
| `TEE` | tee | | `WSP` | working steam pressure |
| `NIP` | nipple | | `CWP` | cold working pressure |
| `ADPT` | adapter | | `NPS` | nominal pipe size |
| `BSHG` | bushing | | `DN` | diamètre nominal |

> This table is the **deterministic pre-pass** that resolves ~40% of classification with no LLM call.
> It should grow from reviewer corrections over time.

---

## 9. Document genres

| Genre | Characteristics | Difficulty |
|---|---|---|
| Single-product spec sheet | One MPN, clean tables | Easy |
| **Family catalog page** | 20–100 MPNs in one table | **Hard — and the most common** |
| Submittal sheet | Dimensional drawing + spec block | Medium |
| Full catalog PDF | 200+ pages, many families | Hard |
| Installation/O&M manual | Prose, few specs | Low value |
| Scanned legacy sheet | No text layer | Requires OCR |

**Family catalog pages are the normal case, not the edge case.** Any system that only handles
single-product sheets has not solved the problem.

---

## 10. Validation rule starter set

| Rule | Statement |
|---|---|
| `PRS-001` | Pressure values are numeric with a unit and a media |
| `PRS-004` | Brass/bronze ball valve WOG ∈ [125, 1000] psi |
| `PRS-011` | WSP ≤ WOG when both present |
| `PRS-017` | PVC/CPVC ratings require a temperature qualifier |
| `SIZ-002` | Nominal size ∈ the standard NPS/DN series |
| `SIZ-005` | Size standard must be explicit when a size is present |
| `END-003` | Inlet and outlet are each from the canonical connection set |
| `END-007` | Solvent-weld connections only on plastic bodies |
| `TMP-002` | `temperature_min` < `temperature_max` |
| `TMP-005` | PTFE seat max temp ≤ ~450°F (verify) |
| `MAT-004` | Lead-free claim requires an NSF/372 or equivalent citation |
| `CLS-001` | Extracted attributes must not contradict the assigned class |

**Every rule needs a passing test, a failing test, and a primary-source citation before it ships.**

---

## ✔ Summary

- PVF is chosen because attribute-driven buying, binary fitment, safety relevance, and brutal unit
  messiness combine to make it the domain where this product's advantages are most visible.
- **Three traps define the technical demo:** NPS is not a length, ANSI Class cannot be derived from
  WOG, and end connections have a dozen synonyms each.
- Six of twenty-two ball-valve attributes are Tier 0, which is why STP is capped near 73% — by design.
- **Family catalog pages are the normal case.** A system that only reads single-product sheets has
  not solved the problem.

## ⚠ Risks

| # | Risk | Mitigation |
|---|---|---|
| L1 | **Rules in this document are from general knowledge and may be wrong in detail** | Verify every rule against MSS SP-110, ASME B16, and manufacturer catalogs before implementing. A wrong rule is a confident wrong answer |
| L2 | Abbreviation dictionary is incomplete | Grow it from reviewer corrections; unknown abbreviations reduce classification confidence rather than being guessed |
| L3 | Class boundaries blur (is a "ball check valve" a ball valve?) | Explicit disambiguation rules; `CLASS_UNRESOLVED` when genuinely ambiguous |

## 💡 Recommendations

1. **Have someone verify §4–§7 against primary sources in week 1.** These become validation rules,
   and a wrong validation rule silently corrupts every downstream number.
2. Build the trap table in §4–§6 into a test fixture immediately — it is the highest-signal test set
   available and it is exactly what a domain-expert judge would write.
3. Treat the abbreviation dictionary as a living asset. Its growth curve is itself a demo artifact:
   "the deterministic layer got better every week without touching the model."
