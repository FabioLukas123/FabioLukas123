"""Detect OpenAI Codex CLI activity for the companion tray icon.

States:
- "off":     no codex process running (icon hidden)
- "idle":    codex is running but not writing to its session logs
- "working": codex wrote to ~/.codex/sessions or ~/.codex/log within the
             last few seconds — i.e. it is actively doing a task

Detection is filesystem/process based only (no Codex API): the Codex CLI
appends to a rollout .jsonl under ~/.codex/sessions/YYYY/MM/DD/ while it
works, so a fresh mtime there is a reliable "busy" signal. Results are
cached for a couple of seconds; everything fails soft to "off".
"""

import time
from datetime import datetime, timedelta
from pathlib import Path

from . import procs

CODEX_DIR = Path.home() / ".codex"
ACTIVE_WINDOW = 20.0   # seconds since last write that still counts as busy
_TTL = 2.0

_cache = {"at": 0.0, "state": "off"}


def _latest_activity():
    newest = 0.0
    # session rollouts are date-sharded; today + yesterday is all we need
    now = datetime.now()
    days = (now, now - timedelta(days=1))
    dirs = [
        CODEX_DIR / "sessions" / "{:04d}".format(d.year)
        / "{:02d}".format(d.month) / "{:02d}".format(d.day)
        for d in days
    ]
    dirs.append(CODEX_DIR / "log")
    for directory in dirs:
        try:
            entries = list(directory.iterdir())
        except OSError:
            continue
        for f in entries:
            try:
                m = f.stat().st_mtime
            except OSError:
                continue
            if m > newest:
                newest = m
    return newest


def status():
    now = time.monotonic()
    if now - _cache["at"] < _TTL:
        return _cache["state"]
    state = "off"
    try:
        if procs.process_running(("codex", "codex.exe")):
            busy = time.time() - _latest_activity() < ACTIVE_WINDOW
            state = "working" if busy else "idle"
    except Exception:
        state = "off"
    _cache["at"] = now
    _cache["state"] = state
    return state
