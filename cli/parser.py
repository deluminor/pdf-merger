from __future__ import annotations

import argparse
from textwrap import dedent


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="🚀 PDF Merger Pro - Merge PDF files from a folder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=dedent("""
            Examples:
              python3 main.py /path/to/folder
              python3 main.py /path/to/folder --output "My Merged Document"
              python3 main.py /path/to/folder -o "Custom Name" --recursive
              python3 main.py . --output "Current Folder PDFs"
            """),
    )

    parser.add_argument("folder_path", help="Path to the folder containing PDF files")
    parser.add_argument(
        "-o",
        "--output",
        help="Custom name for the output PDF (without .pdf extension)",
        default=None,
    )
    parser.add_argument(
        "-r",
        "--recursive",
        action="store_true",
        help="Search for PDFs recursively in subfolders",
    )
    parser.add_argument(
        "--destination",
        help="Destination folder for the output PDF (default: same as source)",
        default=None,
    )

    return parser
