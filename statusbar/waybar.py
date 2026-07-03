"""Waybar custom-module emitter — Claude status without any system tray.

Waybar's ``tray`` module hosts every StatusNotifierItem on the system
(flameshot, bluetooth, ...), which is often unwanted. This mode instead
streams Waybar custom-module JSON lines to stdout, so the Claude status is
just another module in your bar, styled by your own CSS. It needs only the
Python standard library (no pystray/Pillow) — the hooks keep writing the
state files and this reads them directly.

Waybar config (~/.config/waybar/config.jsonc):

    "modules-right": ["custom/claude", "custom/codex", ...],
    "custom/claude": {
        "exec": "env PYTHONPATH=/path/to/claude-status-bar python3 -m statusbar --waybar",
        "return-type": "json",
        "format": "{text}",
        "tooltip": true
    },
    "custom/codex": {
        "exec": "env PYTHONPATH=/path/to/claude-status-bar python3 -m statusbar --waybar-codex",
        "return-type": "json",
        "format": "{text}"
    }

Style hooks (~/.config/waybar/style.css):

    #custom-claude.permission { color: #f5c518; }
    #custom-claude.working    { color: #d97757; }
    #custom-claude.done       { color: #5fb878; }

Each payload carries ``alt`` (state name) and ``class`` so ``format-icons``
and CSS selectors work; ``percentage`` is the estimated 5h-limit usage.
"""

import json
import sys
import time

from . import codex as codex_mod
from . import config, sound, state, usage

from pathlib import Path

# Baked icon frames for Waybar's `image` module (see
# scripts/prerender_waybar_icons.py). Everything here is stdlib-only.
ICONS_DIR = Path(__file__).resolve().parent / "assets" / "waybar"


def _emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def build_claude_payload(status, override, settings, usage_lines):
    """Text payload only — the Clawd artwork itself lives in the adjacent
    image#claude module, so idle states emit empty text."""
    st = status["state"]
    classes = [st]
    if status.get("cowork"):
        classes.append("cowork")
    if override:
        classes.append(override)

    if st in ("thinking", "tool"):
        text = status["label"] or "Working"
        if status["elapsed"]:
            text += " · " + status["elapsed"]
        alt = "working"
    elif st == "permission":
        n = status["waiting"]
        text = "permissão" + ("" if n <= 1 else " ({})".format(n))
        alt = "permission"
    elif st == "done":
        text = "✓"
        alt = "done"
    else:
        text = ""
        alt = override or "idle"

    tooltip = [status["project"] or "Claude Status Bar"]
    if status["count"]:
        tooltip.append("{} sessão(ões), {} aguardando".format(
            status["count"], status["waiting"]))
    tooltip.extend(usage_lines)

    payload = {
        "text": text,
        "alt": alt,
        "class": classes,
        "tooltip": "\n".join(tooltip),
    }
    pct = usage.block_percent(settings)
    if pct is not None:
        payload["percentage"] = int(round(pct))
    return payload


def claude_stream():
    prev = None
    prev_state = "idle"
    while True:
        try:
            settings = config.load_settings()
            sessions = state.read_sessions()
            status = state.aggregate(sessions)
            override = state.auto_pose(status, settings)

            if (
                status["state"] == "done"
                and prev_state != "done"
                and settings.get("completion_sound", True)
            ):
                sound.play_done()
            prev_state = status["state"]

            payload = build_claude_payload(
                status, override, settings, usage.menu_lines(settings))
            if payload != prev:
                _emit(payload)
                prev = payload
        except Exception:
            pass
        # tick every second while working so the elapsed timer advances
        time.sleep(1.0 if prev_state in ("thinking", "tool") else 2.0)


CODEX_TEXT = {"idle": ">_", 0: ">.", 1: ">..", 2: ">..."}


def build_codex_payload(c_state, frame):
    if c_state == "off":
        return {"text": "", "alt": "off", "class": ["off"], "tooltip": "Codex"}
    if c_state == "working":
        return {
            "text": CODEX_TEXT[frame % 3],
            "alt": "working",
            "class": ["working"],
            "tooltip": "Codex — working…",
        }
    return {"text": CODEX_TEXT["idle"], "alt": "idle", "class": ["idle"],
            "tooltip": "Codex — idle"}


def codex_stream():
    prev = None
    frame = 0
    while True:
        try:
            c_state = codex_mod.status()
            frame = frame + 1 if c_state == "working" else 0
            payload = build_codex_payload(c_state, frame)
            if payload != prev:
                _emit(payload)
                prev = payload
        except Exception:
            pass
        time.sleep(0.6 if prev and prev.get("alt") == "working" else 2.0)


# --- image module pickers ----------------------------------------------------
# Waybar's `image` module runs an exec every `interval` seconds and displays
# the PNG whose path the exec prints. These pickers select the right baked
# frame for the current state; animation steps on the wall clock.

def _icon(name, fallback="claude_idle_clawd"):
    path = ICONS_DIR / (name + ".png")
    if not path.is_file():
        path = ICONS_DIR / (fallback + ".png")
    print(str(path), flush=True)


def icon_claude_once():
    settings = config.load_settings()
    status = state.aggregate(state.read_sessions())
    override = state.auto_pose(status, settings)
    sec = int(time.time())
    st = status["state"]

    if status["count"] == 0:
        # no terminal is running Claude -> hide, just like Codex when off
        _icon("off", fallback="off")
    elif st == "permission":
        _icon("claude_permission_{}".format(sec % 2))
    elif st in ("thinking", "tool"):
        if override == "clawd-notebook":
            _icon("claude_work_notebook_{}".format(sec % 2))
        else:
            anim = settings.get("animation", "spark")
            if anim == "clawd":
                _icon("claude_work_clawd_{}".format(sec % 20))
            elif anim == "spinner":
                _icon("claude_work_spinner_{}".format(sec % 12))
            else:
                _icon("claude_work_spark_{}".format(sec % 8))
    elif st == "done":
        _icon("claude_done")
    else:
        pose = override or settings.get("idle_icon", "clawd")
        _icon("claude_idle_{}".format(pose))


def icon_codex_once():
    settings = config.load_settings()
    c_state = codex_mod.status() if settings.get("show_codex", True) else "off"
    ink = "dark" if settings.get("waybar_codex_ink") == "dark" else "light"
    if c_state == "off":
        _icon("off", fallback="off")
    elif c_state == "working":
        _icon("codex_{}_work_{}".format(ink, int(time.time()) % 3))
    else:
        _icon("codex_{}_idle".format(ink))


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    if "--icon-codex" in argv:
        icon_codex_once()
    elif "--icon" in argv:
        icon_claude_once()
    elif "--codex" in argv:
        codex_stream()
    else:
        claude_stream()


if __name__ == "__main__":
    main()
