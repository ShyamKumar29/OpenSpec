"""`LocalFsBlobStore` (docs/10-roadmap.md M0: `BlobStore` port + local FS
adapter) — real filesystem I/O against `tmp_path`, no mocking."""

from __future__ import annotations

from pathlib import Path

import pytest

from openspec.application.ports.blob import BlobNotFound
from openspec.infrastructure.blob.local import LocalFsBlobStore


def test_put_then_get_round_trips_bytes_exactly(tmp_path: Path) -> None:
    store = LocalFsBlobStore(root=tmp_path)
    data = b"raw csv bytes, byte-identical to the upload \x00\x01\x02"
    store.put(key="batch_1/import.csv", data=data)
    assert store.get(key="batch_1/import.csv") == data


def test_get_missing_key_raises_blob_not_found(tmp_path: Path) -> None:
    store = LocalFsBlobStore(root=tmp_path)
    with pytest.raises(BlobNotFound):
        store.get(key="never_written")


def test_exists_true_after_put_false_before(tmp_path: Path) -> None:
    store = LocalFsBlobStore(root=tmp_path)
    assert store.exists(key="k") is False
    store.put(key="k", data=b"x")
    assert store.exists(key="k") is True


def test_overwriting_same_key_returns_latest_bytes(tmp_path: Path) -> None:
    store = LocalFsBlobStore(root=tmp_path)
    store.put(key="k", data=b"first")
    store.put(key="k", data=b"second")
    assert store.get(key="k") == b"second"


def test_keys_with_path_separators_do_not_escape_root(tmp_path: Path) -> None:
    store = LocalFsBlobStore(root=tmp_path)
    store.put(key="../../etc/passwd", data=b"x")
    for path in tmp_path.rglob("*"):
        if path.is_file():
            assert tmp_path in path.resolve().parents


def test_root_directory_is_created_if_missing(tmp_path: Path) -> None:
    root = tmp_path / "nested" / "blobs"
    assert not root.exists()
    LocalFsBlobStore(root=root)
    assert root.exists()


def test_many_distinct_keys_do_not_collide(tmp_path: Path) -> None:
    store = LocalFsBlobStore(root=tmp_path)
    for i in range(50):
        store.put(key=f"batch_{i}/import.csv", data=f"row-{i}".encode())
    for i in range(50):
        assert store.get(key=f"batch_{i}/import.csv") == f"row-{i}".encode()
