#!/usr/bin/env python3
"""Session lifecycle hook for the Claude Status Bar.

Invoked by Claude Code as:
    python lifecycle.py start   # on SessionStart
    python lifecycle.py end     # on SessionEnd

`start` seeds an idle state file for the new session so the tray can show it
immediately; `end` removes the session's state file so it disappears from the
tray. Both paths exit 0 unconditionally.
"""

import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import base_fields, read_event, remove_state, write_state  # noqa: E402


def _maybe_launch_tray():
    """Best-effort launch of the tray app if it does not appear to be running.

    Controlled by the CLAUDE_STATUSBAR_AUTOLAUNCH env var (set by the
    installer). Failure here is harmless and silently ignored.
    """
    if os.environ.get("CLAUDE_STATUSBAR_AUTOLAUNCH") not in ("1", "true", "yes"):
        return
    launcher = os.environ.get("CLAUDE_STATUSBAR_LAUNCHER")
    if not launcher:
        return
    try:
        kwargs = dict(
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if os.name == "nt":
            kwargs["creationflags"] = 0x00000008  # DETACHED_PROCESS
        else:
            kwargs["start_new_session"] = True
        subprocess.Popen([sys.executable, launcher], **kwargs)
    except Exception:
        pass


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "start"
    event = read_event()
    session_id = event.get("session_id") or event.get("sessionId") or ""

    if action == "end":
        remove_state(session_id)
        return

    # action == "start"
    fields = base_fields(event)
    write_state(
        session_id,
        state="idle",
        label="",
        tool="",
        started=False,
        startedAt=0,
        **fields,
    )
    _maybe_launch_tray()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
