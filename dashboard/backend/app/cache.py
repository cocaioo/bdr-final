from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any


@dataclass(slots=True)
class CacheEntry:
    value: Any
    expires_at: datetime


class MemoryCache:
    def __init__(self, ttl_seconds: int = 300) -> None:
        self.ttl = timedelta(seconds=ttl_seconds)
        self._store: dict[str, CacheEntry] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if not entry:
            return None
        if entry.expires_at <= datetime.now(timezone.utc):
            self._store.pop(key, None)
            return None
        return entry.value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = CacheEntry(
            value=value,
            expires_at=datetime.now(timezone.utc) + self.ttl,
        )

    def invalidate_prefix(self, prefix: str) -> None:
        keys = [key for key in self._store if key.startswith(prefix)]
        for key in keys:
            self._store.pop(key, None)

