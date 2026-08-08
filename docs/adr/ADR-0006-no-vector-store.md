# ADR-0006 — No vector database in the MVP
Status: Accepted
Date: 2026-08-07

## Context
"AI product data extraction" strongly implies RAG over a vector store. Our retrieval problem is
finding the document (and row) for a given MPN across a ~400-document corpus.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Dedicated vector DB (Pinecone/Weaviate/Qdrant) | Scales to millions of chunks | Another dependency; **semantic similarity is the wrong tool for exact identifiers**; chunk boundaries are arbitrary; retrieval is unexplainable to a reviewer |
| pgvector in the same Postgres | No new dependency | Same conceptual mismatch at this corpus size |
| **Lexical hierarchy: exact → normalised → supplier → class → token overlap → LLM disambiguation** | Precise on identifiers; **every step is an explainable signal**; feeds the confidence score directly | Will not scale to hundreds of thousands of documents unaided |

## Decision
No vector store. Retrieval is a deterministic lexical hierarchy using Postgres full-text and trigram
indexes, with each step recorded as a named signal that feeds `document_binding.signals` and the
confidence score.

## Consequences
**Easier:** binding decisions are explainable to a reviewer ("exact MPN match on page 2, supplier
matched, class agreed"); no embedding cost; no chunking strategy to tune; retrieval quality is
debuggable with SQL.
**Harder:** genuinely fuzzy cases (a document that never states the MPN) are handled worse — those
correctly become `Unknown(NO_DOCUMENT_FOUND)`.
**Accepted:** for exact-identifier retrieval over a small corpus, lexical is both more accurate and
more explainable. Explainability is a product requirement here, not a preference.

## Revisit when
The corpus exceeds ~100k documents, or the `NO_DOCUMENT_FOUND` rate is dominated by cases where a
semantically-similar document exists but shares no exact tokens. pgvector is available in the same
database on that day.
