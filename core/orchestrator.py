from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from config import constants
from config.settings import MergeSettings
from utils.console import ConsoleMessenger
from utils.file_utils import (
    ensure_pdf_extension,
    ensure_unique_output,
    limit_preview,
    sanitize_filename,
)

from .merger import MergeOutcome, PdfMergerService
from .scanner import PdfScanner


@dataclass
class MergeOrchestrator:
    """High-level workflow orchestrator."""

    scanner: PdfScanner
    merger: PdfMergerService
    messenger: ConsoleMessenger

    def execute(self, settings: MergeSettings) -> Optional[MergeOutcome]:
        folder = settings.folder_path

        if not folder.exists():
            raise FileNotFoundError(f"Folder does not exist: {folder}")
        if not folder.is_dir():
            raise NotADirectoryError(f"Path is not a directory: {folder}")

        print(self.messenger.info(f"Source folder: {folder}"))
        print(
            self.messenger.info(
                f"Recursive search: {'Yes' if settings.recursive else 'No'}"
            )
        )

        pdf_files = self.scanner.scan(settings)
        if not pdf_files:
            print(self.messenger.warning("No PDF files found in the specified folder."))
            if not settings.recursive:
                print(self.messenger.info("Try running again with --recursive"))
            return None

        print(self.messenger.success(f"Found {len(pdf_files)} PDF files"))
        destination = self._resolve_destination(settings.destination, folder)
        output_name = self._resolve_output_name(settings, folder)
        raw_output_path = destination / output_name
        output_path = ensure_unique_output(raw_output_path)

        if output_path != raw_output_path:
            print(
                self.messenger.warning(f"Output file exists, using: {output_path.name}")
            )

        preview = limit_preview(pdf_files, constants.MAX_PREVIEW_FILES)
        self.messenger.print_files(
            preview,
            preview_limit=constants.MAX_PREVIEW_FILES,
            total=len(pdf_files),
        )

        print(self.messenger.info(f"Using {self.merger.library_name} library"))

        if not self.merger.has_progress_bar:
            print(
                self.messenger.warning(
                    "Install 'tqdm' for progress bars: pip install tqdm"
                )
            )

        print(self.messenger.bold(f"\nReady to merge {len(pdf_files)} PDF files!"))
        print(self.messenger.info(f"Output file: {output_path}"))

        outcome = self.merger.merge(pdf_files, output_path)
        return outcome

    def _resolve_destination(self, destination: Optional[Path], fallback: Path) -> Path:
        target = destination or fallback
        if target.exists() and not target.is_dir():
            raise FileExistsError(
                f"Destination path exists and is not a directory: {target}"
            )
        target.mkdir(parents=True, exist_ok=True)

        return target

    def _resolve_output_name(self, settings: MergeSettings, folder: Path) -> str:
        if settings.output_name:
            raw_name = sanitize_filename(settings.output_name)
        else:
            raw_name = sanitize_filename(folder.name)

        return ensure_pdf_extension(raw_name)
