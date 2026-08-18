# LLM cache recordings (`cached` mode)

`infrastructure/llm/cached.py`'s `CachedProvider` replays a recorded response
from this directory, one JSON file per `LlmRequest.request_hash`
(`application/ports/llm.py`).

**Ships empty in this milestone (M0).** No pipeline stage calls the
`LLMProvider` port yet (`docs/15-backend-implementation-status.md` §4's "not
built yet" table — `CLS` residual, `EXT`, `VER` are all later milestones), so
there is no real Anthropic run to record from. Writing a fixture file here now
would mean inventing a model response and presenting it as a recording, which
is exactly the fabrication `docs/16-unilog-alignment.md`'s reference-data
discipline forbids applied to LLM output instead of a client workbook — the
same reasoning `resources/description-formulas/` already documents for its own
empty state.

**Recording format**, once a real run exists to produce one:

```json
{
  "content": "...",
  "model": "claude-...",
  "tokens_in": 123,
  "tokens_out": 45,
  "cached_tokens": 0,
  "cost_usd": 0.01
}
```

File name: `<request_hash>.json`, where `request_hash` is
`LlmRequest.request_hash` — a deterministic digest of `(stage, prompt_version,
model, system, messages)`, so the same request always resolves to the same
recording regardless of which process or run produced it.
