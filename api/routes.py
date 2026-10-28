from __future__ import annotations

import shutil
import tempfile
import time
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from api import constants, store
from api.models import MergeRequest, MergeSession, SessionFile
from api.uploads import copy_upload, validate_pdf
from core.merger import PdfMergerService

router = APIRouter()


@router.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/api/session", status_code=status.HTTP_201_CREATED)
def create_session() -> dict[str, str]:
    store.cleanup_expired_sessions()

    session_id = str(uuid4())
    directory = Path(tempfile.mkdtemp(prefix=constants.TEMP_DIRECTORY_PREFIX))
    store.register_session(session_id, MergeSession(directory=directory))
    return {"id": session_id}


@router.post("/api/session/{session_id}/files", status_code=status.HTTP_201_CREATED)
def upload_files(session_id: str, files: list[UploadFile] = File(...)) -> list[dict]:
    session = store.get_session(session_id)

    if not files:
        raise HTTPException(status_code=400, detail="At least one PDF is required")

    with session.lock:
        store.ensure_current(session_id, session)
        if len(session.files) + len(files) > constants.MAX_FILES_PER_SESSION:
            raise HTTPException(
                status_code=413,
                detail=(
                    "A session may contain at most "
                    f"{constants.MAX_FILES_PER_SESSION} PDFs"
                ),
            )

        remaining_size = constants.MAX_SESSION_SIZE_BYTES - sum(
            file.size for file in session.files.values()
        )

        if remaining_size <= 0:
            raise HTTPException(
                status_code=413, detail="Session size limit has been reached"
            )

        uploaded_files: list[SessionFile] = []
        created_paths: list[Path] = []

        try:
            for upload in files:
                original_name = Path(upload.filename or "").name

                if not original_name.lower().endswith(".pdf"):
                    raise HTTPException(
                        status_code=415, detail="Only .pdf files are allowed"
                    )

                file_id = str(uuid4())
                path = session.directory / f"{file_id}.pdf"

                created_paths.append(path)
                size = copy_upload(
                    upload,
                    path,
                    min(constants.MAX_FILE_SIZE_BYTES, remaining_size),
                )
                pages = validate_pdf(path)
                uploaded_files.append(
                    SessionFile(file_id, original_name, path, size, pages)
                )

                remaining_size -= size
        except Exception:
            for path in created_paths:
                path.unlink(missing_ok=True)
            raise
        finally:
            for upload in files:
                upload.file.close()

        try:
            store.ensure_current(session_id, session)
        except HTTPException:
            for path in created_paths:
                path.unlink(missing_ok=True)
            raise

        obsolete_merge = store.invalidate_merge(session)
        session.files.update({stored.id: stored for stored in uploaded_files})
        session.last_accessed = time.monotonic()

        if obsolete_merge is not None:
            obsolete_merge.unlink(missing_ok=True)

        return [stored.metadata() for stored in uploaded_files]


@router.delete(
    "/api/session/{session_id}/files/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_file(session_id: str, file_id: str) -> None:
    session = store.get_session(session_id)

    with session.lock:
        store.ensure_current(session_id, session)
        stored_file = session.files.pop(file_id, None)

        if stored_file is None:
            raise HTTPException(status_code=404, detail="File not found")

        obsolete_merge = store.invalidate_merge(session)
        stored_file.path.unlink(missing_ok=True)

        if obsolete_merge is not None:
            obsolete_merge.unlink(missing_ok=True)

        session.last_accessed = time.monotonic()


@router.post("/api/session/{session_id}/merge")
def merge_files(session_id: str, request: MergeRequest) -> dict:
    session = store.get_session(session_id)

    with session.lock:
        store.ensure_current(session_id, session)
        if not session.files:
            raise HTTPException(status_code=400, detail="Cannot merge an empty session")
        if not request.order:
            raise HTTPException(
                status_code=400, detail="Merge order must not be empty"
            )
        if len(request.order) != len(set(request.order)):
            raise HTTPException(
                status_code=400,
                detail="Merge order cannot contain duplicate file IDs",
            )

        unknown_ids = [
            file_id for file_id in request.order if file_id not in session.files
        ]

        if unknown_ids:
            raise HTTPException(
                status_code=400,
                detail="Merge order contains files outside this session",
            )

        ordered = [session.files[file_id] for file_id in request.order]
        output_path = session.directory / f"merged-{uuid4()}.pdf"

        try:
            outcome = PdfMergerService().merge(
                (stored.path for stored in ordered), output_path
            )
        except Exception as exc:
            output_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=500, detail="Unable to merge PDFs"
            ) from exc

        if outcome.total_pages == 0:
            output_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=422, detail="One or more PDFs could not be merged"
            )

        path_to_name = {stored.path: stored.name for stored in ordered}
        skipped_names = [
            path_to_name.get(path, path.name) for path in outcome.skipped
        ]

        if not store.is_registered(session_id, session):
            output_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=409,
                detail="Session expired while PDFs were being merged",
            )

        obsolete_merge = session.merged_path
        session.merged_path = output_path
        session.last_accessed = time.monotonic()

        if obsolete_merge is not None:
            obsolete_merge.unlink(missing_ok=True)

        return {
            "download_url": f"/api/session/{session_id}/download",
            "pages": outcome.total_pages,
            "size_mb": outcome.file_size_mb,
            "skipped": skipped_names,
        }


@router.get("/api/session/{session_id}/download")
def download_merged_pdf(session_id: str) -> FileResponse:
    session = store.get_session(session_id)

    with session.lock:
        store.ensure_current(session_id, session)
        merged_path = session.merged_path

        if merged_path is None or not merged_path.is_file():
            raise HTTPException(status_code=404, detail="No merged PDF is available")

        session.last_accessed = time.monotonic()
        path = merged_path

    return FileResponse(
        path=path,
        media_type="application/pdf",
        filename="merged.pdf",
        content_disposition_type="attachment",
    )


@router.delete("/api/session/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str) -> None:
    store.cleanup_expired_sessions()
    session = store.peek_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    with session.lock:
        if not store.pop_session(session_id, session):
            raise HTTPException(status_code=404, detail="Session not found")
        shutil.rmtree(session.directory, ignore_errors=True)
