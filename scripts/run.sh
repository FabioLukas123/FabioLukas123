#!/usr/bin/env bash
# Convenience launcher for Linux: create a venv on first run, install deps,
# then start the tray app from the repo root.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_DIR}"

VENV="${REPO_DIR}/.venv"
if [[ ! -d "${VENV}" ]]; then
  python3 -m venv --system-site-packages "${VENV}"
  "${VENV}/bin/pip" install --upgrade pip >/dev/null
  "${VENV}/bin/pip" install -r requirements.txt
fi

exec "${VENV}/bin/python" -m statusbar
