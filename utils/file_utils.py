from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Iterable, List

from config import constants


def sanitize_filename(filename: str) -> str:
    """Remove invalid characters and compact underscores."""
    sanitized = re.sub(r'[<>:"/\\|?*]', "_", filename)
    sanitized = re.sub(r"_+", "_", sanitized)
    return sanitized.strip("_ ")


def ensure_pdf_extension(name: str) -> str:
    """Append .pdf extension when user omits it."""
    if not name.lower().endswith(constants.PDF_EXTENSION):
        return f"{name}{constants.PDF_EXTENSION}"
    return name


def ensure_unique_output(path: Path) -> Path:
    """Add timestamp when file already exists."""
    if not path.exists():
        return path
    timestamp = datetime.now().strftime(constants.TIMESTAMP_PATTERN)
    return path.with_name(f"{path.stem}_{timestamp}{constants.PDF_EXTENSION}")


def limit_preview(files: Iterable[Path], limit: int) -> List[str]:
    """Return first N file names for preview."""
    preview = []
    for idx, pdf_file in enumerate(files):
        if idx >= limit:
            break
        preview.append(pdf_file.name)
    return preview
