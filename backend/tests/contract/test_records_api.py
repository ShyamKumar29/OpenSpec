"""Contract tests for `GET /records` / `GET /records/{id}` against
`frontend/lib/contracts/record.ts` + `attribute-value.ts` (docs/api.md §Records).
Run with the `memory` repository backend — see docs/15-backend-implementation-status.md
for why Postgres isn't exercised here.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from openspec.api.main import create_app
from openspec.infrastructure.memory.repositories import CANONICAL_RECORD_ID


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    with TestClient(app) as c:
        yield c


def test_health(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_list_records_envelope_shape(client: TestClient) -> None:
    resp = client.get("/api/v1/records")
    assert resp.status_code == 200
    assert "X-Correlation-Id" in resp.headers
    body = resp.json()
    assert "items" in body and "next_cursor" in body
    assert len(body["items"]) >= 1
    first = body["items"][0]
    for field in (
        "id",
        "mpn_raw",
        "description_raw",
        "supplier_name",
        "status",
        "class",
        "completeness",
        "tier0_pending_count",
        "unknown_count",
        "has_document",
        "created_at",
    ):
        assert field in first, f"missing field {field!r} in RecordSummary wire shape"


def test_list_records_pagination(client: TestClient) -> None:
    resp = client.get("/api/v1/records", params={"limit": 1})
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["next_cursor"] is not None

    resp2 = client.get("/api/v1/records", params={"limit": 1, "cursor": body["next_cursor"]})
    body2 = resp2.json()
    assert body2["items"][0]["id"] != body["items"][0]["id"]


def test_get_record_detail_matches_wire_contract(client: TestClient) -> None:
    resp = client.get(f"/api/v1/records/{CANONICAL_RECORD_ID}")
    assert resp.status_code == 200
    body = resp.json()

    # RecordDetailWire = RecordSummaryWire & { bindings, attributes }
    assert body["id"] == CANONICAL_RECORD_ID
    assert body["mpn_raw"] == "ABC-123"
    assert isinstance(body["bindings"], list) and len(body["bindings"]) == 1
    assert isinstance(body["attributes"], list) and len(body["attributes"]) > 0


def test_get_record_detail_every_attribute_obeys_inv1_and_inv4(client: TestClient) -> None:
    """The wire-level proof that INV-1/INV-4 survived serialisation: every non-UNKNOWN
    attribute carries evidence + provenance + confidence + verification, and every
    UNKNOWN carries a reason and nothing else — the same assertion
    `frontend/lib/contracts/attribute-value.ts`'s `adaptAttributeValue` makes on the
    client side of this exact response.
    """
    resp = client.get(f"/api/v1/records/{CANONICAL_RECORD_ID}")
    body = resp.json()
    for av in body["attributes"]:
        if av["status"] == "UNKNOWN":
            assert av["unknown_reason"] is not None
            assert av["value_display"] is None
            assert av["evidence"] == []
        else:
            assert av["unknown_reason"] is None
            assert len(av["evidence"]) >= 1
            assert av["provenance_kind"] is not None
            assert av["verification"] is not None


def test_tier0_pressure_rating_is_needs_approval_never_accepted(client: TestClient) -> None:
    """INV-9 on the wire: the demo record states 600 WOG, and the API must never
    report `pressure_rating_wog` as ACCEPTED — Tier 0 always needs a human approval."""
    resp = client.get(f"/api/v1/records/{CANONICAL_RECORD_ID}")
    body = resp.json()
    wog = next(a for a in body["attributes"] if a["attribute"]["code"] == "pressure_rating_wog")
    assert wog["status"] == "NEEDS_APPROVAL"
    assert wog["attribute"]["risk_tier"] == 0


def test_ansi_class_is_unknown_not_derived_from_wog(client: TestClient) -> None:
    """CLAUDE.md domain trap: "600 WOG != Class 150. Never derive one from the
    other — return Unknown." The demo document only states WOG; ansi_class must
    come back Unknown, never a guessed ANSI class."""
    resp = client.get(f"/api/v1/records/{CANONICAL_RECORD_ID}")
    body = resp.json()
    ansi = next(a for a in body["attributes"] if a["attribute"]["code"] == "ansi_class")
    assert ansi["status"] == "UNKNOWN"
    assert ansi["unknown_reason"] == "ATTRIBUTE_NOT_IN_DOCUMENT"


def test_get_unknown_record_returns_rfc9457_problem(client: TestClient) -> None:
    resp = client.get("/api/v1/records/does-not-exist")
    assert resp.status_code == 404
    assert resp.headers["content-type"] == "application/problem+json"
    body = resp.json()
    assert body["code"] == "NOT_FOUND"
    assert body["status"] == 404
    assert "correlation_id" in body
    # Body correlation_id must match the response header (docs/api.md §Conventions).
    assert body["correlation_id"] == resp.headers["X-Correlation-Id"]
