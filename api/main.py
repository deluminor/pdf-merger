from __future__ import annotations

from contextlib import asynccontextmanager

import shutil
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import RLock
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pypdf import PdfReader

from core.merger import PdfMergerService

SESSION_TTL_SECONDS = 60 * 60
MAX_FILES_PER_SESSION = 20
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
MAX_SESSION_SIZE_BYTES = 200 * 1024 * 1024
COPY_CHUNK_SIZE = 1024 * 1024
TEMP_DIRECTORY_PREFIX = "pdf-merger-"


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


@asynccontextmanager
async def lifespan(_: FastAPI):
    _sweep_orphaned_session_directories()
    yield


app = FastAPI(title="PDF Merger API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_sessions: dict[str, MergeSession] = {}
_sessions_lock = RLock()


def _sweep_orphaned_session_directories() -> None:
    """Remove directories left behind by a process that exited unexpectedly."""
    for directory in Path(tempfile.gettempdir()).glob(f"{TEMP_DIRECTORY_PREFIX}*"):
        if directory.is_dir():
            shutil.rmtree(directory, ignore_errors=True)


def _cleanup_expired_sessions() -> None:
    """Detach expired sessions before deleting their directories."""
    now = time.monotonic()
    with _sessions_lock:
        expired = [
            _sessions.pop(session_id)
            for session_id, session in list(_sessions.items())
            if now - session.last_accessed >= SESSION_TTL_SECONDS
        ]
    for session in expired:
        # Never remove a directory while a request is reading or writing it.
        with session.lock:
            shutil.rmtree(session.directory, ignore_errors=True)


def _get_session(session_id: str) -> MergeSession:
    _cleanup_expired_sessions()
    with _sessions_lock:
        session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _ensure_current(session_id: str, session: MergeSession) -> None:
    """Confirm a leased session has not been deleted or expired."""
    with _sessions_lock:
        if _sessions.get(session_id) is not session:
            raise HTTPException(status_code=404, detail="Session not found")


def _invalidate_merge(session: MergeSession) -> Path | None:
    merged_path = session.merged_path
    session.merged_path = None
    session.generation += 1
    return merged_path


def _copy_upload(upload: UploadFile, destination: Path, maximum_size: int) -> int:
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


def _validate_pdf(path: Path) -> int:
    try:
        with path.open("rb") as uploaded:
            pages = len(PdfReader(uploaded).pages)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Uploaded file is not a valid PDF") from exc
    if pages == 0:
        raise HTTPException(status_code=422, detail="Uploaded PDF must contain at least one page")
    return pages


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/session", status_code=status.HTTP_201_CREATED)
def create_session() -> dict[str, str]:
    _cleanup_expired_sessions()

    session_id = str(uuid4())
    directory = Path(tempfile.mkdtemp(prefix=TEMP_DIRECTORY_PREFIX))

    with _sessions_lock:
        _sessions[session_id] = MergeSession(directory=directory)
    return {"id": session_id}


@app.post("/api/session/{session_id}/files", status_code=status.HTTP_201_CREATED)
def upload_files(session_id: str, files: list[UploadFile] = File(...)) -> list[dict]:
    session = _get_session(session_id)

    if not files:
        raise HTTPException(status_code=400, detail="At least one PDF is required")

    with session.lock:
        _ensure_current(session_id, session)
        if len(session.files) + len(files) > MAX_FILES_PER_SESSION:
            raise HTTPException(
                status_code=413,
                detail=f"A session may contain at most {MAX_FILES_PER_SESSION} PDFs",
            )

        remaining_size = MAX_SESSION_SIZE_BYTES - sum(file.size for file in session.files.values())

        if remaining_size <= 0:
            raise HTTPException(status_code=413, detail="Session size limit has been reached")

        uploaded_files: list[SessionFile] = []
        created_paths: list[Path] = []

        try:
            for upload in files:
                original_name = Path(upload.filename or "").name

                if not original_name.lower().endswith(".pdf"):
                    raise HTTPException(status_code=415, detail="Only .pdf files are allowed")

                file_id = str(uuid4())
                path = session.directory / f"{file_id}.pdf"

                created_paths.append(path)
                size = _copy_upload(upload, path, min(MAX_FILE_SIZE_BYTES, remaining_size))
                pages = _validate_pdf(path)
                uploaded_files.append(SessionFile(file_id, original_name, path, size, pages))

                remaining_size -= size
        except Exception:
            for path in created_paths:
                path.unlink(missing_ok=True)
            raise
        finally:
            for upload in files:
                upload.file.close()

        try:
            _ensure_current(session_id, session)
        except HTTPException:
            for path in created_paths:
                path.unlink(missing_ok=True)
            raise

        obsolete_merge = _invalidate_merge(session)
        session.files.update({stored.id: stored for stored in uploaded_files})
        session.last_accessed = time.monotonic()

        if obsolete_merge is not None:
            obsolete_merge.unlink(missing_ok=True)

        return [stored.metadata() for stored in uploaded_files]


@app.delete("/api/session/{session_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(session_id: str, file_id: str) -> None:
    session = _get_session(session_id)

    with session.lock:
        _ensure_current(session_id, session)
        stored_file = session.files.pop(file_id, None)

        if stored_file is None:
            raise HTTPException(status_code=404, detail="File not found")

        obsolete_merge = _invalidate_merge(session)
        stored_file.path.unlink(missing_ok=True)

        if obsolete_merge is not None:
            obsolete_merge.unlink(missing_ok=True)

        session.last_accessed = time.monotonic()


@app.post("/api/session/{session_id}/merge")
def merge_files(session_id: str, request: MergeRequest) -> dict:
    session = _get_session(session_id)

    with session.lock:
        _ensure_current(session_id, session)
        if not session.files:
            raise HTTPException(status_code=400, detail="Cannot merge an empty session")
        if not request.order:
            raise HTTPException(status_code=400, detail="Merge order must not be empty")
        if len(request.order) != len(set(request.order)):
            raise HTTPException(status_code=400, detail="Merge order cannot contain duplicate file IDs")

        unknown_ids = [file_id for file_id in request.order if file_id not in session.files]

        if unknown_ids:
            raise HTTPException(status_code=400, detail="Merge order contains files outside this session")

        output_path = session.directory / f"merged-{uuid4()}.pdf"

        try:
            outcome = PdfMergerService().merge(
                (session.files[file_id].path for file_id in request.order), output_path
            )
        except Exception as exc:
            output_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="Unable to merge PDFs") from exc
        if outcome.skipped:
            output_path.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail="One or more PDFs could not be merged")

        with _sessions_lock:
            still_current = _sessions.get(session_id) is session
        if not still_current:
            output_path.unlink(missing_ok=True)
            raise HTTPException(status_code=409, detail="Session expired while PDFs were being merged")

        obsolete_merge = session.merged_path
        session.merged_path = output_path
        session.last_accessed = time.monotonic()

        if obsolete_merge is not None:
            obsolete_merge.unlink(missing_ok=True)

        return {
            "download_url": f"/api/session/{session_id}/download",
            "pages": outcome.total_pages,
            "size_mb": outcome.file_size_mb,
        }


@app.get("/api/session/{session_id}/download")
def download_merged_pdf(session_id: str) -> Response:
    session = _get_session(session_id)

    with session.lock:
        _ensure_current(session_id, session)
        merged_path = session.merged_path

        if merged_path is None or not merged_path.is_file():
            raise HTTPException(status_code=404, detail="No merged PDF is available")

        content = merged_path.read_bytes()
        session.last_accessed = time.monotonic()
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="merged.pdf"'},
    )


@app.delete("/api/session/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str) -> None:
    _cleanup_expired_sessions()
    with _sessions_lock:
        session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    with session.lock:
        with _sessions_lock:
            if _sessions.pop(session_id, None) is not session:
                raise HTTPException(status_code=404, detail="Session not found")
        shutil.rmtree(session.directory, ignore_errors=True)
