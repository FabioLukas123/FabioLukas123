#!/usr/bin/env python3
"""Install the Claude Status Bar hooks into Claude Code.

Cross-platform (Arch Linux / Windows / macOS). This merges the status-bar hooks
into ``~/.claude/settings.json`` using the current Python interpreter and
absolute script paths, backing up any existing settings first. It never removes
or rewrites hooks it did not create.

Usage:
    python install.py            # install hooks (+ offer autostart)
    python install.py --no-autostart
"""

import json
import os
import shutil
import stat
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent
HOOKS_DIR = REPO / "hooks"
LIFECYCLE = HOOKS_DIR / "lifecycle.py"
UPDATE = HOOKS_DIR / "update.py"
CLAUDE_SETTINGS = Path.home() / ".claude" / "settings.json"

PY = sys.executable or "python3"

# (event, matcher-or-None, script, arg)
HOOK_SPECS = [
    ("SessionStart", None, LIFECYCLE, "start"),
    ("SessionEnd", None, LIFECYCLE, "end"),
    ("UserPromptSubmit", None, UPDATE, "prompt"),
    ("PreToolUse", "*", UPDATE, "pre"),
    ("PostToolUse", "*", UPDATE, "post"),
    ("Notification", None, UPDATE, "notify"),
    ("Stop", None, UPDATE, "stop"),
]

MARKER = str(HOOKS_DIR)  # any command containing this path is "ours"


def _command(script, arg):
    return '"{py}" "{script}" {arg}'.format(py=PY, script=script, arg=arg)


def _load_settings():
    if CLAUDE_SETTINGS.exists():
        try:
            with CLAUDE_SETTINGS.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                return data
        except Exception as exc:
            print("! Could not parse existing settings.json: {}".format(exc))
            print("  Aborting so your file is left untouched.")
            sys.exit(1)
    return {}


def _backup():
    if CLAUDE_SETTINGS.exists():
        backup = CLAUDE_SETTINGS.with_suffix(
            ".json.statusbar-backup-{}".format(int(time.time()))
        )
        shutil.copy2(CLAUDE_SETTINGS, backup)
        print("• Backed up existing settings to {}".format(backup.name))


def _strip_ours(hooks):
    """Remove previously-installed status-bar entries so re-installs are clean."""
    cleaned = {}
    for event, groups in hooks.items():
        if not isinstance(groups, list):
            cleaned[event] = groups
            continue
        new_groups = []
        for group in groups:
            inner = group.get("hooks", []) if isinstance(group, dict) else []
            kept = [h for h in inner if MARKER not in str(h.get("command", ""))]
            if kept:
                new_group = dict(group)
                new_group["hooks"] = kept
                new_groups.append(new_group)
            elif not inner:
                new_groups.append(group)
        if new_groups:
            cleaned[event] = new_groups
    return cleaned


def install():
    if not LIFECYCLE.exists() or not UPDATE.exists():
        print("! Hook scripts not found next to this installer. Aborting.")
        sys.exit(1)

    CLAUDE_SETTINGS.parent.mkdir(parents=True, exist_ok=True)
    settings = _load_settings()
    _backup()

    hooks = _strip_ours(settings.get("hooks", {}) or {})

    for event, matcher, script, arg in HOOK_SPECS:
        entry = {"type": "command", "command": _command(script, arg), "timeout": 5}
        group = {"hooks": [entry]}
        if matcher is not None:
            group = {"matcher": matcher, "hooks": [entry]}
        hooks.setdefault(event, [])
        hooks[event].append(group)

    settings["hooks"] = hooks

    tmp = CLAUDE_SETTINGS.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(settings, fh, indent=2)
    os.replace(str(tmp), str(CLAUDE_SETTINGS))

    # Make the hook scripts executable on POSIX (harmless on Windows).
    for script in (LIFECYCLE, UPDATE):
        try:
            mode = os.stat(script).st_mode
            os.chmod(script, mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        except Exception:
            pass

    print("✓ Installed status-bar hooks into {}".format(CLAUDE_SETTINGS))
    print("  Interpreter: {}".format(PY))


def maybe_autostart():
    if "--no-autostart" in sys.argv:
        return
    print()
    print("To start the tray app now:   {} -m statusbar".format(PY))
    if os.name == "nt":
        print("To enable autostart on Windows:")
        print("  powershell -ExecutionPolicy Bypass -File packaging\\windows\\install-autostart.ps1")
    else:
        print("To enable autostart on Arch Linux (systemd user service):")
        print("  bash packaging/arch/install-autostart.sh")


if __name__ == "__main__":
    install()
    maybe_autostart()
    print()
    print("Done. New Claude Code sessions will report status to the tray.")
