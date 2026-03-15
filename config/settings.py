from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class MergeSettings:
    """User provided CLI options after validation."""

    folder_path: Path
    recursive: bool
    output_name: Optional[str]
    destination: Optional[Path]
