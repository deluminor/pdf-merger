#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
VENV_PY="$ROOT/venv/bin/python"

if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "error: $PYTHON not found" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm not found (need Node.js >= 18)" >&2
  exit 1
fi

if [[ ! -x "$VENV_PY" ]]; then
  echo "Creating venv..."
  rm -rf "$ROOT/venv"
  "$PYTHON" -m venv "$ROOT/venv"
fi

if ! "$VENV_PY" -m pip --version >/dev/null 2>&1; then
  echo "Bootstrapping pip in venv..."
  "$VENV_PY" -m ensurepip --upgrade
fi

echo "Installing Python deps..."
"$VENV_PY" -m pip install -q -r requirements.txt

echo "Installing web deps..."
(
  cd web
  npm install --silent
)

API_PID=""
WEB_PID=""

cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Starting API on http://127.0.0.1:8000 ..."
"$VENV_PY" -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000 &
API_PID=$!

echo "Starting UI on http://localhost:5173 ..."
(
  cd web
  npm run dev -- --host 127.0.0.1 --port 5173
) &
WEB_PID=$!

echo
echo "Ready."
echo "  UI  → http://localhost:5173"
echo "  API → http://127.0.0.1:8000"
echo "Ctrl+C stops both."
echo

wait
