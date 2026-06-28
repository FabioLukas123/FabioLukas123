#!/usr/bin/env python3
"""Headless tests for the hook -> state-file -> aggregate pipeline.

Runnable without any GUI dependencies (no pystray / Pillow needed):
    python tests/test_state.py
"""

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "hooks"))

import _common  # noqa: E402  (the hooks' shared helpers)
from statusbar import config, state  # noqa: E402


def _redirect_state_dir(tmp):
    """Point both the writer (hooks) and reader (app) at the same temp dir."""
    state_dir = Path(tmp) / "state.d"
    state_dir.mkdir(parents=True, exist_ok=True)
    _common.STATE_DIR = state_dir
    config.STATE_DIR = state_dir
    return state_dir


def test_write_and_read_roundtrip(tmp):
    _redirect_state_dir(tmp)
    _common.write_state(
        "sess-a", state="thinking", label="Thinking…",
        project="myrepo", started=True, startedAt=_common.now_ms(),
    )
    sessions = state.read_sessions()
    assert len(sessions) == 1, sessions
    assert sessions[0]["sessionId"] == "sess-a"
    assert sessions[0]["state"] == "thinking"
    print("ok: write/read roundtrip")


def test_aggregate_permission_wins(tmp):
    _redirect_state_dir(tmp)
    _common.write_state("a", state="thinking", label="Thinking…", project="p1",
                        started=True, startedAt=_common.now_ms())
    _common.write_state("b", state="permission", label="Awaiting permission",
                        project="p2")
    agg = state.aggregate(state.read_sessions())
    assert agg["state"] == "permission", agg
    assert agg["waiting"] == 1, agg
    assert agg["count"] == 2, agg
    print("ok: permission outranks thinking")


def test_session_end_removes_file(tmp):
    _redirect_state_dir(tmp)
    _common.write_state("gone", state="idle", project="p")
    assert len(state.read_sessions()) == 1
    _common.remove_state("gone")
    assert len(state.read_sessions()) == 0
    print("ok: session end clears state file")


def test_done_collapses_to_idle(tmp):
    state_dir = _redirect_state_dir(tmp)
    old = _common.now_ms() - (config.DONE_LINGER_MS + 1000)
    _common.write_state("d", state="done", label="Done", project="p",
                        doneAt=old)
    # Make the file's ts old too, but still within the stale TTL.
    sessions = state.read_sessions()
    assert sessions, "expected the done session to still be present"
    assert sessions[0]["state"] == "idle", sessions[0]
    print("ok: lingering done collapses to idle")


def test_tool_label_mapping():
    assert _common.TOOL_LABELS["Bash"] == "Running command"
    assert _common.TOOL_LABELS["Edit"] == "Editing"
    assert _common.TOOL_LABELS["Read"] == "Reading"
    print("ok: tool label mapping")


def main():
    tests = [
        test_tool_label_mapping,
        test_write_and_read_roundtrip,
        test_aggregate_permission_wins,
        test_session_end_removes_file,
        test_done_collapses_to_idle,
    ]
    failures = 0
    for fn in tests:
        with tempfile.TemporaryDirectory() as tmp:
            try:
                if fn.__code__.co_argcount == 1:
                    fn(tmp)
                else:
                    fn()
            except AssertionError as exc:
                failures += 1
                print("FAIL: {} -> {}".format(fn.__name__, exc))
            except Exception as exc:  # noqa: BLE001
                failures += 1
                print("ERROR: {} -> {!r}".format(fn.__name__, exc))
    print()
    if failures:
        print("{} test(s) failed".format(failures))
        sys.exit(1)
    print("All tests passed.")


if __name__ == "__main__":
    main()
