"""`LocalFsBlobStore` — filesystem-backed `BlobStore` (docs/13-implementation-
blueprint.md step 6: `infrastructure/blob/local.py`). The `local` topology's
adapter (docs/07-devops.md §3) and the one exercised by this repo's tests —
real filesystem I/O, no mocking, no live cloud dependency.

Keys are treated as opaque strings, not filesystem paths: a key is hashed into
a two-level directory prefix so a batch of thousands of imports doesn't dump
thousands of files into one directory, and `..`/absolute-path keys can't escape
`root` (a defensive check, not a security boundary this dev adapter needs to be
airtight about — see `infrastructure/fetch/` for where that discipline matters,
once it exists).
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from openspec.application.ports.blob import BlobNotFound


class LocalFsBlobStore:
    def __init__(self, root: Path) -> None:
        self._root = root
        self._root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, key: str) -> Path:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        safe_chars = "".join(c if c.isalnum() or c in "._-" else "_" for c in key)
        safe_name = f"{digest[:16]}-{safe_chars}"
        return self._root / digest[:2] / digest[2:4] / safe_name

    def put(self, *, key: str, data: bytes) -> str:
        path = self._path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get(self, *, key: str) -> bytes:
        path = self._path_for(key)
        if not path.exists():
            raise BlobNotFound(key)
        return path.read_bytes()

    def exists(self, *, key: str) -> bool:
        return self._path_for(key).exists()
