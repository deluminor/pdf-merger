from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from api import constants, store
from api.models import MergeRequest, MergeSession, SessionFile
from api.routes import (
    create_session,
    delete_file,
    delete_session,
    download_merged_pdf,
    health,
    merge_files,
    router,
    upload_files,
)
from api.uploads import copy_upload, validate_pdf
from core.merger import PdfMergerService

# Re-exports keep existing tests and monkeypatches stable.
SESSION_TTL_SECONDS = constants.SESSION_TTL_SECONDS
MAX_FILES_PER_SESSION = constants.MAX_FILES_PER_SESSION
MAX_FILE_SIZE_BYTES = constants.MAX_FILE_SIZE_BYTES
MAX_SESSION_SIZE_BYTES = constants.MAX_SESSION_SIZE_BYTES
COPY_CHUNK_SIZE = constants.COPY_CHUNK_SIZE
TEMP_DIRECTORY_PREFIX = constants.TEMP_DIRECTORY_PREFIX
_sessions = store._sessions
_sessions_lock = store._sessions_lock


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.sweep_orphaned_session_directories()
    yield


app = FastAPI(title="PDF Merger API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=constants.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


def _sweep_orphaned_session_directories() -> None:
    store.sweep_orphaned_session_directories()


def _cleanup_expired_sessions() -> None:
    store.cleanup_expired_sessions()


def _get_session(session_id: str) -> MergeSession:
    return store.get_session(session_id)


def _ensure_current(session_id: str, session: MergeSession) -> None:
    store.ensure_current(session_id, session)


def _invalidate_merge(session: MergeSession) -> Path | None:
    return store.invalidate_merge(session)


def _copy_upload(upload: UploadFile, destination: Path, maximum_size: int) -> int:
    return copy_upload(upload, destination, maximum_size)


def _validate_pdf(path: Path) -> int:
    return validate_pdf(path)


__all__ = [
    "COPY_CHUNK_SIZE",
    "MAX_FILES_PER_SESSION",
    "MAX_FILE_SIZE_BYTES",
    "MAX_SESSION_SIZE_BYTES",
    "MergeRequest",
    "MergeSession",
    "PdfMergerService",
    "SESSION_TTL_SECONDS",
    "SessionFile",
    "TEMP_DIRECTORY_PREFIX",
    "_cleanup_expired_sessions",
    "_copy_upload",
    "_ensure_current",
    "_get_session",
    "_invalidate_merge",
    "_sessions",
    "_sessions_lock",
    "_sweep_orphaned_session_directories",
    "_validate_pdf",
    "app",
    "create_session",
    "delete_file",
    "delete_session",
    "download_merged_pdf",
    "health",
    "merge_files",
    "upload_files",
]
