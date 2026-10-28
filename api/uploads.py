from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from pypdf import PdfReader

from api.constants import COPY_CHUNK_SIZE


def copy_upload(upload: UploadFile, destination: Path, maximum_size: int) -> int:
    """Copy incrementally so a forged Content-Length cannot bypass limits."""
    size = 0

    with destination.open("wb") as output:
        while chunk := upload.file.read(COPY_CHUNK_SIZE):
            size += len(chunk)
            if size > maximum_size:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail="Upload exceeds the session or individual-file size limit",
                )
            output.write(chunk)

    return size


def validate_pdf(path: Path) -> int:
    try:
        with path.open("rb") as uploaded:
            pages = len(PdfReader(uploaded).pages)
    except Exception as exc:
        raise HTTPException(
            status_code=422, detail="Uploaded file is not a valid PDF"
        ) from exc
    if pages == 0:
        raise HTTPException(
            status_code=422, detail="Uploaded PDF must contain at least one page"
        )
    return pages
