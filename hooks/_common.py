"""Shared helpers for the Claude Status Bar hooks.

These hooks are intentionally dependency-free and self-contained so they can be
launched directly by Claude Code on any platform (Arch Linux, Windows, macOS)
without the rest of the project being importable. They must never raise: a
crashing hook would interfere with the Claude Code session, so every public
helper swallows its own errors and the entry points exit 0 no matter what.
"""

import json
import os
import sys
import time
from pathlib import Path

# State lives next to Claude Code's own config so a single well-known location
# works the same on every OS: ~/.claude/statusbar/state.d/<session_id>.json
STATE_DIR = Path.home() / ".claude" / "statusbar" / "state.d"

# Tool name -> human readable label, mirrored from the original project so the
# tray UI reads the same on Linux/Windows as the macOS menu bar did.
TOOL_LABELS = {
    "Bash": "Running command",
    "Edit": "Editing",
    "Write": "Writing",
    "MultiEdit": "Editing",
    "NotebookEdit": "Editing",
    "Read": "Reading",
    "Grep": "Searching",
    "Glob": "Searching",
    "LS": "Listing files",
    "WebFetch": "Browsing web",
    "WebSearch": "Searching web",
    "Task": "Delegating",
    "TodoWrite": "Planning",
}


def _ancestor_blob(max_depth=8):
    """comm+cmdline of this hook's process ancestors, lowercased (POSIX)."""
    names = []
    try:
        pid = os.getppid()
        for _ in range(max_depth):
            if pid <= 1:
                break
            try:
                comm = (Path("/proc") / str(pid) / "comm").read_text().strip()
            except Exception:
                comm = ""
            try:
                raw = (Path("/proc") / str(pid) / "cmdline").read_bytes()
                cmd = raw.replace(b"\x00", b" ").decode("utf-8", "ignore")
            except Exception:
                cmd = ""
            names.append((comm + " " + cmd).lower())
            try:
                stat = (Path("/proc") / str(pid) / "stat").read_text()
                pid = int(stat.rsplit(")", 1)[1].split()[1])
            except Exception:
                break
    except Exception:
        pass
    return " ".join(names)


# other CLIs that reuse ~/.claude/settings.json and fire these same hooks
_FOREIGN_MARKERS = ("grok", "xai", "gemini", "codex", "aider", "opencode",
                    "cursor-agent", "qwen", "llxprt")


def detect_client():
    """Which CLI actually fired this hook: a foreign name, or 'claude'.

    Grok and other Claude-Code-compatible CLIs read the same settings.json
    and run these hooks, which would light up the Claude status bar. Their
    binary/name shows up in this hook's process ancestry, so we look for a
    known foreign marker there. This check is unconditional — it does NOT
    defer to CLAUDECODE/CLAUDE_CODE_ENTRYPOINT, because a compatible CLI may
    set those same env vars on purpose (or inherit them from the shell) to
    make itself look like Claude Code to hooks exactly like this one.
    Anything without a foreign marker is treated as Claude, so a real
    session is never hidden by a detection miss.
    """
    blob = _ancestor_blob()
    for name in _FOREIGN_MARKERS:
        if name in blob:
            return name
    return "claude"


def is_claude_code():
    """False only when a foreign CLI (Grok, …) is positively detected."""
    if os.environ.get("CLAUDE_STATUSBAR_ALL_CLIENTS") in ("1", "true", "yes"):
        return True
    return detect_client() == "claude"


def read_event():
    """Read and parse the JSON hook payload Claude Code sends on stdin."""
    try:
        raw = sys.stdin.read()
    except Exception:
        return {}
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _state_path(session_id):
    return STATE_DIR / "{}.json".format(session_id)


def now_ms():
    return int(time.time() * 1000)


def project_name(cwd):
    if not cwd:
        return ""
    try:
        return Path(cwd).name or str(Path(cwd))
    except Exception:
        return ""


def load_state(session_id):
    """Return the existing state dict for a session, or a fresh skeleton."""
    path = _state_path(session_id)
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def write_state(session_id, **fields):
    """Atomically merge *fields* into the session's state file.

    Writes to a temp file then renames so the tray app never reads a half
    written JSON document. Missing directories are created on demand.
    """
    if not session_id:
        return
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        return

    state = load_state(session_id)
    state.update(fields)
    state["sessionId"] = session_id
    state["ts"] = now_ms()
    state.setdefault("pid", os.getppid())

    path = _state_path(session_id)
    tmp = path.with_suffix(".{}.tmp".format(os.getpid()))
    try:
        with tmp.open("w", encoding="utf-8") as fh:
            json.dump(state, fh)
        os.replace(str(tmp), str(path))
    except Exception:
        try:
            tmp.unlink()
        except Exception:
            pass


def remove_state(session_id):
    if not session_id:
        return
    try:
        _state_path(session_id).unlink()
    except FileNotFoundError:
        pass
    except Exception:
        pass


def base_fields(event):
    """Common fields derived from any hook payload."""
    cwd = event.get("cwd") or os.getcwd()
    # Was this session started from a terminal or by an app (e.g. the Claude
    # desktop app / Cowork)? Terminals leave at least one of these behind.
    from_terminal = any(
        os.environ.get(var)
        for var in ("TERM_PROGRAM", "WT_SESSION", "TERM", "SSH_TTY")
    )
    return {
        "project": project_name(cwd),
        "cwd": cwd,
        "transcript": event.get("transcript_path", ""),
        "entrypoint": event.get("source") or event.get("entrypoint") or "",
        "claude_entrypoint": os.environ.get("CLAUDE_CODE_ENTRYPOINT", ""),
        "launcher": "terminal" if from_terminal else "app",
        "term_program": os.environ.get("TERM_PROGRAM", ""),
        "client": detect_client() or "claude",
    }


if __name__ == "__main__":
    # Diagnostic: `python3 hooks/_common.py` — run this FROM INSIDE the CLI
    # session you want to inspect (e.g. as a one-off command in Grok's own
    # shell/tool), so its process is actually in the ancestry being walked.
    print("PID desta chamada:", os.getpid(), "PPID:", os.getppid())
    print("CLAUDECODE=", os.environ.get("CLAUDECODE"))
    print("CLAUDE_CODE_ENTRYPOINT=", os.environ.get("CLAUDE_CODE_ENTRYPOINT"))
    blob = _ancestor_blob()
    print("--- cadeia de processos ancestrais (comm+cmdline) ---")
    print(blob)
    print("--- marcadores estrangeiros configurados ---")
    print(_FOREIGN_MARKERS)
    hits = [m for m in _FOREIGN_MARKERS if m in blob]
    print("marcadores encontrados no blob:", hits or "nenhum")
    print("detect_client() ->", detect_client())
