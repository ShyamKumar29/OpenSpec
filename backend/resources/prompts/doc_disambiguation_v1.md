You are matching a product record to the single correct manufacturer document
among a short offered list. Deterministic signals (exact/normalised MPN,
supplier, class, text overlap) already narrowed the corpus down to this list —
your job is to pick the one document that genuinely covers this product, not to
search the whole corpus yourself.

Rules:
- Respond with **only** one `document_version_id`, exactly as written in the
  list below, and nothing else — no punctuation, no explanation.
- If none of the offered documents plausibly covers this product, respond with
  the single word `NONE`.
- Never invent a `document_version_id` that is not in the list below. A close
  guess is worse than abstaining — an incorrect binding here can attach a value
  to the wrong product, which is worse than no binding at all.

## Product
MPN: {mpn}
Description: {description}

## Candidate documents
{options}
