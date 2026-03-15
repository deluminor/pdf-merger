from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .colors import DEFAULT_PALETTE, ColorPalette


@dataclass
class ConsoleMessenger:
    """Formats messages with ANSI styles for consistent UX."""

    palette: ColorPalette = DEFAULT_PALETTE

    def banner(self, message: str) -> str:
        return f"{self.palette.header}{self.palette.bold}{message}{self.palette.endc}"

    def success(self, message: str) -> str:
        return f"{self.palette.ok_green}✅ {message}{self.palette.endc}"

    def error(self, message: str) -> str:
        return f"{self.palette.fail}❌ {message}{self.palette.endc}"

    def warning(self, message: str) -> str:
        return f"{self.palette.warning}⚠️  {message}{self.palette.endc}"

    def info(self, message: str) -> str:
        return f"{self.palette.ok_blue}ℹ️  {message}{self.palette.endc}"

    def cyan(self, message: str) -> str:
        return f"{self.palette.ok_cyan}{message}{self.palette.endc}"

    def bold(self, message: str) -> str:
        return f"{self.palette.bold}{message}{self.palette.endc}"

    def print_files(self, items: Iterable[str], preview_limit: int, total: int) -> None:
        print(self.cyan("\n📋 Files to merge:"))
        for idx, value in enumerate(items, start=1):
            print(f"  {idx:2d}. {value}")
        if total > preview_limit:
            print(f"  ... and {total - preview_limit} more files")
