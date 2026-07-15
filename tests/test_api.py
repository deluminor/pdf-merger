from __future__ import annotations

import shutil
import time
from io import BytesIO
from pathlib import Path
from threading import Event, Thread

import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter

import api.main as api
from core.merger import MergeOutcome


def pdf_bytes(pages: int = 1) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=72, height=72)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.fixture(autouse=True)
def clear_sessions():
    with api._sessions_lock:
        sessions = list(api._sessions.values())
        api._sessions.clear()
    for session in sessions:
        with session.lock:
            shutil.rmtree(session.directory, ignore_errors=True)
    yield
    with api._sessions_lock:
        sessions = list(api._sessions.values())
        api._sessions.clear()
    for session in sessions:
        with session.lock:
            shutil.rmtree(session.directory, ignore_errors=True)


@pytest.fixture
def client() -> TestClient:
    return TestClient(api.app)


def new_session(client: TestClient) -> str:
    response = client.post("/api/session")
    assert response.status_code == 201
    return response.json()["id"]


def upload(client: TestClient, session_id: str, content: bytes, name: str = "input.pdf"):
    return client.post(
        f"/api/session/{session_id}/files",
        files=[("files", (name, content, "application/pdf"))],
    )


def test_health_upload_merge_order_pages_and_download(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}
    session_id = new_session(client)
    first = upload(client, session_id, pdf_bytes(1), "first.pdf")
    second = upload(client, session_id, pdf_bytes(2), "second.pdf")
    assert first.status_code == second.status_code == 201

    order = [second.json()[0]["id"], first.json()[0]["id"]]
    merged = client.post(f"/api/session/{session_id}/merge", json={"order": order})
    assert merged.status_code == 200
    assert merged.json()["pages"] == 3
    downloaded = client.get(merged.json()["download_url"])
    assert downloaded.status_code == 200
    assert downloaded.headers["content-type"].startswith("application/pdf")
    assert len(PdfReader(BytesIO(downloaded.content)).pages) == 3


def test_rejects_empty_and_non_pdf_uploads(client: TestClient) -> None:
    session_id = new_session(client)
    empty = upload(client, session_id, pdf_bytes(0))
    assert empty.status_code == 422
    assert "at least one page" in empty.json()["detail"]

    non_pdf = upload(client, session_id, b"plain text", "notes.txt")
    assert non_pdf.status_code == 415


def test_upload_quotas_are_enforced_while_streaming(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    document = pdf_bytes()
    monkeypatch.setattr(api, "MAX_FILE_SIZE_BYTES", 10)
    session_id = new_session(client)
    # The server counts read chunks; it does not trust a multipart size header.
    assert upload(client, session_id, document).status_code == 413

    monkeypatch.setattr(api, "MAX_FILE_SIZE_BYTES", 10_000)
    monkeypatch.setattr(api, "MAX_FILES_PER_SESSION", 1)
    assert upload(client, session_id, document).status_code == 201
    assert upload(client, session_id, document, "second.pdf").status_code == 413


def test_session_quota_rejects_second_upload_before_disk_overflow(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    document = pdf_bytes()
    monkeypatch.setattr(api, "MAX_FILE_SIZE_BYTES", 10_000)
    monkeypatch.setattr(api, "MAX_SESSION_SIZE_BYTES", len(document) + 1)
    session_id = new_session(client)
    assert upload(client, session_id, document).status_code == 201
    assert upload(client, session_id, document, "second.pdf").status_code == 413
    with api._sessions_lock:
        assert len(api._sessions[session_id].files) == 1


def test_expired_sessions_and_startup_orphans_are_removed(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(api, "SESSION_TTL_SECONDS", 1)
    session_id = new_session(client)
    with api._sessions_lock:
        session = api._sessions[session_id]
        session.last_accessed -= 2
        directory = session.directory
    assert client.get(f"/api/session/{session_id}/download").status_code == 404
    assert not directory.exists()

    orphan = tmp_path / f"{api.TEMP_DIRECTORY_PREFIX}orphan"
    orphan.mkdir()
    monkeypatch.setattr(api.tempfile, "gettempdir", lambda: str(tmp_path))
    api._sweep_orphaned_session_directories()
    assert not orphan.exists()


def test_merge_does_not_hold_registry_lock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started = Event()
    finish = Event()

    class BlockingMerger:
        def merge(self, paths, output_path):
            started.set()
            assert finish.wait(2)
            Path(output_path).write_bytes(pdf_bytes())
            return MergeOutcome(Path(output_path), 1, 0.001)

    monkeypatch.setattr(api, "PdfMergerService", BlockingMerger)
    session_id = api.create_session()["id"]
    with api._sessions_lock:
        session = api._sessions[session_id]
    source = session.directory / "source.pdf"
    source.write_bytes(pdf_bytes())
    session.files["file"] = api.SessionFile("file", "source.pdf", source, source.stat().st_size, 1)

    worker = Thread(target=lambda: api.merge_files(session_id, api.MergeRequest(order=["file"])))
    worker.start()
    assert started.wait(1)
    # A different session can still be created while this merge performs I/O.
    assert api.create_session()["id"]
    finish.set()
    worker.join(2)
    assert not worker.is_alive()


def test_delete_waits_for_active_merge_before_removing_directory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started = Event()
    finish = Event()

    class BlockingMerger:
        def merge(self, paths, output_path):
            started.set()
            assert finish.wait(2)
            Path(output_path).write_bytes(pdf_bytes())
            return MergeOutcome(Path(output_path), 1, 0.001)

    monkeypatch.setattr(api, "PdfMergerService", BlockingMerger)
    session_id = api.create_session()["id"]
    with api._sessions_lock:
        session = api._sessions[session_id]
    source = session.directory / "source.pdf"
    source.write_bytes(pdf_bytes())
    session.files["file"] = api.SessionFile("file", "source.pdf", source, source.stat().st_size, 1)

    merge_thread = Thread(target=lambda: api.merge_files(session_id, api.MergeRequest(order=["file"])))
    delete_thread = Thread(target=lambda: api.delete_session(session_id))
    merge_thread.start()
    assert started.wait(1)
    delete_thread.start()
    time.sleep(0.05)
    assert delete_thread.is_alive()
    assert session.directory.exists()
    finish.set()
    merge_thread.join(2)
    delete_thread.join(2)
    assert not merge_thread.is_alive()
    assert not delete_thread.is_alive()
    assert not session.directory.exists()


def test_upload_waits_for_merge_then_invalidates_stale_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started = Event()
    finish = Event()

    class BlockingMerger:
        def merge(self, paths, output_path):
            started.set()
            assert finish.wait(2)
            Path(output_path).write_bytes(pdf_bytes())
            return MergeOutcome(Path(output_path), 1, 0.001)

    monkeypatch.setattr(api, "PdfMergerService", BlockingMerger)
    session_id = api.create_session()["id"]
    with api._sessions_lock:
        session = api._sessions[session_id]
    source = session.directory / "source.pdf"
    source.write_bytes(pdf_bytes())
    session.files["file"] = api.SessionFile("file", "source.pdf", source, source.stat().st_size, 1)

    merge_thread = Thread(target=lambda: api.merge_files(session_id, api.MergeRequest(order=["file"])))
    uploaded: list[dict] = []
    upload_thread = Thread(
        target=lambda: uploaded.extend(
            api.upload_files(
                session_id,
                [UploadFile(file=BytesIO(pdf_bytes()), filename="later.pdf")],
            )
        )
    )
    merge_thread.start()
    assert started.wait(1)
    upload_thread.start()
    time.sleep(0.05)
    assert upload_thread.is_alive()
    finish.set()
    merge_thread.join(2)
    upload_thread.join(2)
    assert uploaded and uploaded[0]["name"] == "later.pdf"
    with pytest.raises(HTTPException) as error:
        api.download_merged_pdf(session_id)
    assert error.value.status_code == 404
