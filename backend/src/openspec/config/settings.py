"""`Settings -> build adapters -> build use cases -> hand to FastAPI dependencies`
(docs/05-backend.md §4). Fails fast on a missing required value, never silently
defaults something security- or correctness-sensitive.
"""

from __future__ import annotations

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OPENSPEC_", env_file=".env")

    repository_backend: Literal["memory", "postgres"] = "memory"
    """`postgres` selects `infrastructure/db` (docs/04-data-model.md's schema) once
    that repository implementation exists (docs/15-backend-implementation-status.md
    §Remaining work). Not wired yet — selecting it today raises at startup rather
    than silently falling back to `memory`, per CLAUDE.md: "contract violation ->
    crash loudly"."""

    database_url: str | None = None
    default_tenant_id: str = "tenant_demo"


def get_settings() -> Settings:
    return Settings()
