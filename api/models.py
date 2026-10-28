from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import RLock

from pydantic import BaseModel, Field


@dataclass
class SessionFile:
    """A PDF stored in one API session."""

    id: str
    name: str
    path: Path
    size: int
    pages: int

    def metadata(self) -> dict[str, int | str]:
        return {
            "id": self.id,
            "name": self.name,
            "size": self.size,
            "pages": self.pages,
        }


@dataclass
class MergeSession:
    """Server-side state and temporary files for a client session."""

    directory: Path
    files: dict[str, SessionFile] = field(default_factory=dict)
    merged_path: Path | None = None
    last_accessed: float = field(default_factory=time.monotonic)
    generation: int = 0
    lock: RLock = field(default_factory=RLock, repr=False)


class MergeRequest(BaseModel):
    order: list[str] = Field(description="Uploaded file IDs in merge order")
