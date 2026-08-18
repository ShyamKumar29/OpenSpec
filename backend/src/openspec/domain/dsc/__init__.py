"""`DSC` — pure description-construction logic (UH5, ADR-0013,
docs/16-unilog-alignment.md UH5). INV-6: no I/O, no LLM call — every clause
comes from an already-accepted `AttributeValue` already in the domain layer's
own store, per ADR-0013's decision. Reads nothing outside `domain/model/`.
"""
