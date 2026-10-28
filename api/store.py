from __future__ import annotations

import shutil
import tempfile
import time
from pathlib import Path
from threading import RLock

from fastapi import HTTPException

from api import constants
from api.models import MergeSession

_sessions: dict[str, MergeSession] = {}
_sessions_lock = RLock()


def sweep_orphaned_session_directories() -> None:
    """Remove directories left behind by a process that exited unexpectedly."""
    for directory in Path(tempfile.gettempdir()).glob(
        f"{constants.TEMP_DIRECTORY_PREFIX}*"
    ):
        if directory.is_dir():
            shutil.rmtree(directory, ignore_errors=True)


def cleanup_expired_sessions() -> None:
    """Detach expired sessions before deleting their directories."""
    now = time.monotonic()
    with _sessions_lock:
        expired = [
            _sessions.pop(session_id)
            for session_id, session in list(_sessions.items())
            if now - session.last_accessed >= constants.SESSION_TTL_SECONDS
        ]
    for session in expired:
        # Never remove a directory while a request is reading or writing it.
        with session.lock:
            shutil.rmtree(session.directory, ignore_errors=True)


def get_session(session_id: str) -> MergeSession:
    cleanup_expired_sessions()
    with _sessions_lock:
        session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def ensure_current(session_id: str, session: MergeSession) -> None:
    """Confirm a leased session has not been deleted or expired."""
    with _sessions_lock:
        if _sessions.get(session_id) is not session:
            raise HTTPException(status_code=404, detail="Session not found")


def invalidate_merge(session: MergeSession) -> Path | None:
    merged_path = session.merged_path
    session.merged_path = None
    session.generation += 1
    return merged_path


def register_session(session_id: str, session: MergeSession) -> None:
    with _sessions_lock:
        _sessions[session_id] = session


def is_registered(session_id: str, session: MergeSession) -> bool:
    with _sessions_lock:
        return _sessions.get(session_id) is session


def peek_session(session_id: str) -> MergeSession | None:
    with _sessions_lock:
        return _sessions.get(session_id)


def pop_session(session_id: str, expected: MergeSession) -> bool:
    """Remove session if it still matches. Returns True when popped."""
    with _sessions_lock:
        if _sessions.get(session_id) is not expected:
            return False
        _sessions.pop(session_id, None)
        return True
