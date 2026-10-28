from __future__ import annotations

import os

SESSION_TTL_SECONDS = 60 * 60
MAX_FILES_PER_SESSION = 20
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
MAX_SESSION_SIZE_BYTES = 200 * 1024 * 1024
COPY_CHUNK_SIZE = 1024 * 1024
TEMP_DIRECTORY_PREFIX = "pdf-merger-"
DEFAULT_CORS_ORIGINS = "http://localhost:5173"


def cors_origins() -> list[str]:
    """Comma-separated origins from PDF_MERGER_CORS_ORIGINS, else local Vite."""
    raw = os.environ.get("PDF_MERGER_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
