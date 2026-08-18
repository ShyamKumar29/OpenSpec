"""DOC — document retrieval/binding (`docs/10-roadmap.md` M2). Pure: the
candidate-search cascade and conflict detection. Candidate *search* itself is
deterministic code end to end (`CLAUDE.md` "Where AI is allowed": "Candidate search
(exact -> normalised -> fuzzy)" is in the **banned-for-AI** column) — only the final
disambiguation step, when deterministic tiers leave a small ambiguous pool, is where
an LLM call is permitted (`CLAUDE.md`: "Document/row binding disambiguation" is
allowed), and even then it must pick from an offered set, never invent a document.
"""
