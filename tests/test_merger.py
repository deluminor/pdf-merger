from pathlib import Path

from pypdf import PdfWriter

from core.merger import PdfMergerService


def make_pdf(path: Path, pages: int) -> None:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=72, height=72)
    with path.open("wb") as output:
        writer.write(output)


def test_merge_combines_pages_and_reports_output(tmp_path: Path) -> None:
    first = tmp_path / "first.pdf"
    second = tmp_path / "second.pdf"
    output = tmp_path / "result.pdf"
    make_pdf(first, 1)
    make_pdf(second, 2)

    outcome = PdfMergerService().merge([first, second], output)

    assert output.is_file()
    assert outcome.total_pages == 3
    assert outcome.skipped == ()
    assert outcome.file_size_mb > 0


def test_merge_skips_unreadable_files(tmp_path: Path) -> None:
    valid = tmp_path / "valid.pdf"
    invalid = tmp_path / "invalid.pdf"
    output = tmp_path / "result.pdf"
    make_pdf(valid, 1)
    invalid.write_bytes(b"not a PDF")

    outcome = PdfMergerService().merge([valid, invalid], output)

    assert outcome.total_pages == 1
    assert outcome.skipped == (invalid,)
    assert output.is_file()
