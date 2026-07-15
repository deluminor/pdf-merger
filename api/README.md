# PDF Merger API

Run the backend from the project root:

```bash
uvicorn api.main:app --reload
```

Endpoints:

- `GET /api/health`
- `POST /api/session` creates a temporary upload session.
- `POST /api/session/{id}/files` accepts one or more multipart fields named `files` and returns metadata for each accepted PDF.
- `DELETE /api/session/{id}/files/{file_id}` removes an uploaded file.
- `POST /api/session/{id}/merge` accepts `{ "order": ["file_id", ...] }` and returns the download URL and merge statistics.
- `GET /api/session/{id}/download` downloads the merged document.
- `DELETE /api/session/{id}` deletes the session and its temporary files.

Temporary uploads use the operating system temp directory and are removed through the session delete endpoint.
