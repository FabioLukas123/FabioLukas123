"""Read and aggregate the per-session state files into a single status."""

import json
import os
import time

from . import config


def _pid_alive(pid):
    """Cross-platform best-effort check that *pid* is still running."""
    if not pid:
        return True  # unknown -> assume alive, rely on staleness TTL instead
    try:
        pid = int(pid)
    except (TypeError, ValueError):
        return True
    if os.name == "nt":
        try:
            import ctypes

            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            handle = ctypes.windll.kernel32.OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION, False, pid
            )
            if not handle:
                return False
            ctypes.windll.kernel32.CloseHandle(handle)
            return True
        except Exception:
            return True
    else:
        try:
            os.kill(pid, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
        except Exception:
            return True


def _now_ms():
    return int(time.time() * 1000)


def read_sessions():
    """Return a list of live session dicts, newest activity first.

    Sessions whose owning process is gone, or whose files are older than the
    stale TTL, are skipped (and their files swept away).
    """
    sessions = []
    now = _now_ms()
    try:
        entries = list(config.STATE_DIR.glob("*.json"))
    except Exception:
        return sessions

    for path in entries:
        try:
            with path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue

        ts = data.get("ts", 0)
        pid = data.get("pid")
        age = now - ts if ts else None

        # Sweep clearly-dead sessions so they don't linger in the tray.
        if (age is not None and age > config.STALE_AFTER_MS) or not _pid_alive(pid):
            try:
                path.unlink()
            except Exception:
                pass
            continue

        # A "done" state that has lingered long enough collapses to idle.
        if data.get("state") == "done":
            done_at = data.get("doneAt", ts)
            if done_at and now - done_at > config.DONE_LINGER_MS:
                data["state"] = "idle"
                data["label"] = ""

        sessions.append(data)

    sessions.sort(key=lambda s: s.get("ts", 0), reverse=True)
    return sessions


def _format_elapsed(ms):
    if not ms:
        return ""
    secs = max(0, (_now_ms() - ms) // 1000)
    minutes, seconds = divmod(secs, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return "{}:{:02d}:{:02d}".format(hours, minutes, seconds)
    return "{}:{:02d}".format(minutes, seconds)


def aggregate(sessions):
    """Collapse all sessions into one headline status for the icon/title.

    Returns a dict: ``state``, ``label``, ``project``, ``elapsed`` (str),
    ``count`` (total sessions), ``waiting`` (number awaiting permission).
    """
    if not sessions:
        return {
            "state": "idle",
            "label": "",
            "project": "",
            "elapsed": "",
            "count": 0,
            "waiting": 0,
        }

    # Highest-priority state wins; ties broken by most recent activity.
    headline = max(
        sessions,
        key=lambda s: (
            config.STATE_PRIORITY.get(s.get("state", "idle"), 0),
            s.get("ts", 0),
        ),
    )
    state = headline.get("state", "idle")
    waiting = sum(1 for s in sessions if s.get("state") == "permission")

    elapsed = ""
    if state in ("thinking", "tool") and config.load_settings().get("show_timer", True):
        elapsed = _format_elapsed(headline.get("startedAt"))

    return {
        "state": state,
        "label": headline.get("label", ""),
        "project": headline.get("project", ""),
        "elapsed": elapsed,
        "count": len(sessions),
        "waiting": waiting,
    }


def session_line(session):
    """One-line human description of a session for the dropdown menu."""
    project = session.get("project") or "(no project)"
    state = session.get("state", "idle")
    label = session.get("label", "")
    if state == "idle":
        return "{} — idle".format(project)
    if state == "permission":
        return "⚠ {} — awaiting permission".format(project)
    if state == "done":
        return "✓ {} — done".format(project)
    suffix = label or state
    if session.get("startedAt") and config.load_settings().get("show_timer", True):
        suffix = "{}  {}".format(suffix, _format_elapsed(session.get("startedAt")))
    return "{} — {}".format(project, suffix)
