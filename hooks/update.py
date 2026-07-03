#!/usr/bin/env python3
"""State-transition hook for the Claude Status Bar.

Invoked by Claude Code for the various activity events:
    python update.py prompt    # UserPromptSubmit  -> thinking
    python update.py pre       # PreToolUse        -> tool (with label)
    python update.py post      # PostToolUse       -> thinking
    python update.py notify    # Notification      -> permission (if relevant)
    python update.py permreq   # PermissionRequest -> permission
    python update.py stop      # Stop              -> done -> idle

Each invocation merges a small state delta into the session's JSON file. The
tray app polls those files and renders the aggregate status. Always exits 0.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import (  # noqa: E402
    TOOL_LABELS,
    base_fields,
    now_ms,
    read_event,
    write_state,
)


def _notification_kind(event):
    """Classify a Notification event.

    "permission"  -> Claude is blocked on an approval (show the alert)
    "awaiting"    -> Claude finished and is just waiting for the next
                     message ("waiting for your input" fires ~60s idle);
                     this is NOT a permission and must not raise the alert
    "other"       -> anything else (refresh metadata only)
    """
    text = (event.get("message") or event.get("notification") or "").lower()
    if "permission" in text or "approve" in text or "authoriz" in text:
        return "permission"
    if "waiting for your input" in text or "waiting for input" in text:
        return "awaiting"
    return "other"


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    event = read_event()
    session_id = event.get("session_id") or event.get("sessionId") or ""
    if not session_id:
        return

    common = base_fields(event)

    if action == "prompt":
        write_state(
            session_id,
            state="thinking",
            label="Thinking…",
            tool="",
            started=True,
            startedAt=now_ms(),
            **common,
        )

    elif action == "pre":
        tool = event.get("tool_name") or event.get("tool") or ""
        label = TOOL_LABELS.get(tool, "Using tool")
        write_state(
            session_id,
            state="tool",
            label=label,
            tool=tool,
            started=True,
            **common,
        )

    elif action == "post":
        write_state(
            session_id,
            state="thinking",
            label="Thinking…",
            tool="",
            started=True,
            **common,
        )

    elif action == "permreq" or (
        action == "notify" and _notification_kind(event) == "permission"
    ):
        write_state(
            session_id,
            state="permission",
            label="Awaiting permission",
            tool="",
            **common,
        )

    elif action == "notify" and _notification_kind(event) == "awaiting":
        # Claude finished its turn and is just waiting for the next message —
        # plain idle, NOT a permission alert.
        write_state(
            session_id,
            state="idle",
            label="",
            tool="",
            started=False,
            **common,
        )

    elif action == "notify":
        # A non-permission notification: leave the state untouched but refresh
        # the metadata / timestamp so the session is not considered stale.
        write_state(session_id, **common)

    elif action == "stop":
        write_state(
            session_id,
            state="done",
            label="Done",
            tool="",
            started=False,
            doneAt=now_ms(),
            **common,
        )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
