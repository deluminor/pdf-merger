from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, List, Optional, Tuple

try:
    from pypdf import PdfReader, PdfWriter

    PDF_LIB = "pypdf"
    PDF_IMPORT_ERROR: Optional[str] = None
except ImportError:  # pragma: no cover - fallback runtime path
    try:
        from PyPDF2 import PdfReader, PdfWriter

        PDF_LIB = "PyPDF2"
        PDF_IMPORT_ERROR = None
    except ImportError:  # pragma: no cover - runtime guard
        # Stub assignment when both pypdf and PyPDF2 unavailable; checked at merge()
        PdfReader = PdfWriter = None  # type: ignore[assignment]
        PDF_LIB = "Unavailable"
        PDF_IMPORT_ERROR = "Install either 'pypdf' or 'PyPDF2' to use the merger"

try:  # pragma: no cover - optional dependency
    from tqdm import tqdm

    HAS_TQDM = True
except ImportError:  # pragma: no cover - fallback path
    tqdm = None
    HAS_TQDM = False


@dataclass(frozen=True)
class MergeOutcome:
    """Statistics about the merged document."""

    output_path: Path
    total_pages: int
    file_size_mb: float
    skipped: Tuple[Path, ...] = ()


@dataclass
class PdfMergerService:
    """Responsible for combining PDFs into a single file."""

    progress_callback: Optional[Callable[[str], None]] = None
    error_callback: Optional[Callable[[str], None]] = None

    @property
    def library_name(self) -> str:
        return PDF_LIB

    @property
    def has_progress_bar(self) -> bool:
        return HAS_TQDM

    def _progress(self, msg: str) -> None:
        if self.progress_callback:
            self.progress_callback(msg)

    def _error(self, msg: str) -> None:
        if self.error_callback:
            self.error_callback(msg)

    def merge(self, pdf_files: Iterable[Path], output_path: Path) -> MergeOutcome:
        if PDF_IMPORT_ERROR:
            raise RuntimeError(PDF_IMPORT_ERROR)

        pdf_writer = PdfWriter()
        files = list(pdf_files)
        total_pages = 0
        skipped: List[Path] = []

        progress_bar = (
            tqdm(files, desc="Processing PDFs", unit="file") if HAS_TQDM else None
        )
        iterator = progress_bar or files

        for index, pdf_path in enumerate(iterator, start=1):
            if progress_bar is None:
                self._progress(
                    f"  📄 Processing: {pdf_path.name} ({index}/{len(files)})"
                )
            try:
                with open(pdf_path, "rb") as handle:
                    reader = PdfReader(handle)
                    for page in reader.pages:
                        pdf_writer.add_page(page)
                    pages_added = len(reader.pages)
                    total_pages += pages_added
                    if progress_bar is not None:
                        progress_bar.set_postfix(
                            {"Pages": total_pages, "Current": f"{pages_added}p"}
                        )
                    else:
                        self._progress(f"    ✓ Added {pages_added} pages")
            except Exception as exc:
                skipped.append(pdf_path)
                self._error(f"Failed to process {pdf_path.name}: {exc}")

        if progress_bar is not None:
            progress_bar.close()

        self._progress(f"Saving merged PDF to: {output_path}")
        with open(output_path, "wb") as handle:
            pdf_writer.write(handle)

        file_size_mb = output_path.stat().st_size / (1024 * 1024)
        return MergeOutcome(
            output_path=output_path,
            total_pages=total_pages,
            file_size_mb=file_size_mb,
            skipped=tuple(skipped),
        )
