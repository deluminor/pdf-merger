# PDF Merger API

Run the backend from the project root:

```bash
uvicorn api.main:app --reload --port 8000
```

Optional CORS (comma-separated). Default is local Vite:

```bash
export PDF_MERGER_CORS_ORIGINS="http://localhost:5173,https://example.com"
```

Endpoints:

- `GET /api/health`
- `POST /api/session` creates a temporary upload session.
- `POST /api/session/{id}/files` accepts one or more multipart fields named `files` and returns metadata for each accepted PDF.
- `DELETE /api/session/{id}/files/{file_id}` removes an uploaded file.
- `POST /api/session/{id}/merge` accepts `{ "order": ["file_id", ...] }` and returns `download_url`, `pages`, `size_mb`, and `skipped` (original filenames that failed during merge). Returns 422 when no pages could be merged.
- `GET /api/session/{id}/download` streams the merged document.
- `DELETE /api/session/{id}` deletes the session and its temporary files.

Limits: 20 files per session, 50 MB per file, 200 MB per session, 1h TTL.

Temporary uploads use the operating system temp directory and are removed through the session delete endpoint.
