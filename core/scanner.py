from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List

from config.settings import MergeSettings


@dataclass
class PdfScanner:
    """Discovers PDF files based on provided settings."""

    def scan(self, settings: MergeSettings) -> List[Path]:
        pattern = "**/*.pdf" if settings.recursive else "*.pdf"
        pdf_files = sorted(
            settings.folder_path.glob(pattern), key=lambda path: path.name.lower()
        )

        return [path for path in pdf_files if path.is_file()]
