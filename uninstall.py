#!/usr/bin/env python3
"""Remove the Claude Status Bar hooks from Claude Code.

Only the status-bar entries are stripped from ``~/.claude/settings.json`` — any
other hooks you have configured are left exactly as they were. Optionally clears
the cached session state files too.

Usage:
    python uninstall.py            # remove hooks
    python uninstall.py --purge    # also delete ~/.claude/statusbar
"""

import json
import os
import shutil
import sys
import time
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent / "hooks"
CLAUDE_SETTINGS = Path.home() / ".claude" / "settings.json"
STATUSBAR_DIR = Path.home() / ".claude" / "statusbar"
MARKER = str(HOOKS_DIR)


def _strip_ours(hooks):
    cleaned = {}
    removed = 0
    for event, groups in hooks.items():
        if not isinstance(groups, list):
            cleaned[event] = groups
            continue
        new_groups = []
        for group in groups:
            inner = group.get("hooks", []) if isinstance(group, dict) else []
            kept = [h for h in inner if MARKER not in str(h.get("command", ""))]
            removed += len(inner) - len(kept)
            if kept:
                ng = dict(group)
                ng["hooks"] = kept
                new_groups.append(ng)
            elif not inner:
                new_groups.append(group)
        if new_groups:
            cleaned[event] = new_groups
    return cleaned, removed


def main():
    if CLAUDE_SETTINGS.exists():
        try:
            with CLAUDE_SETTINGS.open("r", encoding="utf-8") as fh:
                settings = json.load(fh)
        except Exception:
            print("! Could not parse settings.json; leaving it untouched.")
            settings = None

        if isinstance(settings, dict) and isinstance(settings.get("hooks"), dict):
            backup = CLAUDE_SETTINGS.with_suffix(
                ".json.statusbar-backup-{}".format(int(time.time()))
            )
            shutil.copy2(CLAUDE_SETTINGS, backup)

            settings["hooks"], removed = _strip_ours(settings["hooks"])
            if not settings["hooks"]:
                settings.pop("hooks", None)

            tmp = CLAUDE_SETTINGS.with_suffix(".json.tmp")
            with tmp.open("w", encoding="utf-8") as fh:
                json.dump(settings, fh, indent=2)
            os.replace(str(tmp), str(CLAUDE_SETTINGS))
            print("✓ Removed {} status-bar hook(s). Backup: {}".format(
                removed, backup.name))
        else:
            print("• No status-bar hooks found in settings.json.")
    else:
        print("• No settings.json found; nothing to remove.")

    if "--purge" in sys.argv:
        try:
            shutil.rmtree(STATUSBAR_DIR)
            print("✓ Removed {}".format(STATUSBAR_DIR))
        except FileNotFoundError:
            pass
        except Exception as exc:
            print("! Could not remove {}: {}".format(STATUSBAR_DIR, exc))

    print("Done.")


if __name__ == "__main__":
    main()
