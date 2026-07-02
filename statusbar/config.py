"""Paths, constants and persisted user settings for the tray app."""

import json
import os
from pathlib import Path

# --- Well-known locations (identical layout to the hooks) --------------------
CLAUDE_DIR = Path.home() / ".claude"
STATUSBAR_DIR = CLAUDE_DIR / "statusbar"
STATE_DIR = STATUSBAR_DIR / "state.d"
SETTINGS_PATH = STATUSBAR_DIR / "config.json"

# --- Colours -----------------------------------------------------------------
CLAUDE_CORAL = (217, 119, 87)      # #D97757 — Claude's signature orange
PERMISSION_AMBER = (245, 197, 24)  # #F5C518 — "needs you" yellow
DONE_GREEN = (95, 184, 120)        # #5FB878 — completed
NEUTRAL_GREY = (150, 150, 150)     # idle, system-adaptive fallback

# --- Behaviour ---------------------------------------------------------------
POLL_INTERVAL = 0.2                # seconds between state polls / anim frames
SPINNER_FRAMES = 12                # number of frames in the working animation
DONE_LINGER_MS = 4000              # how long "Done" shows before going idle
STALE_AFTER_MS = 6 * 60 * 60 * 1000  # drop crashed-session files after 6h
MAX_MENU_SESSIONS = 8              # session rows shown in the dropdown
ICON_SIZE = 64                     # rendered icon size in pixels

# Priority used to pick the single "headline" state shown on the icon.
STATE_PRIORITY = {
    "permission": 4,
    "tool": 3,
    "thinking": 3,
    "done": 2,
    "idle": 1,
}

DEFAULT_SETTINGS = {
    "show_timer": True,
    "completion_sound": True,
    "animation": "spark",     # "spark" | "spinner" | "clawd"
    "color": "orange",        # "orange" | "system"
    # resting icon: "logo" (Claude spark) or one of the Clawd poses
    # ("clawd" | "clawd-sunglasses" | "clawd-headphones" | "clawd-notebook")
    "idle_icon": "logo",
    # automatic poses: headphones while Spotify runs, notebook while a
    # Cowork session works (Windows only)
    "auto_poses": True,
    # substrings matched against a session's entrypoint fields to flag it as
    # a Cowork / desktop-app session
    "cowork_markers": ["cowork", "desktop"],
}

# old asset name -> current one (settings written by previous versions)
_RENAMED_VALUES = {"clawd-skateboard": "clawd-notebook"}


def load_settings():
    """Load persisted UI settings, falling back to defaults for any gaps."""
    settings = dict(DEFAULT_SETTINGS)
    try:
        with SETTINGS_PATH.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict):
            settings.update({k: data[k] for k in data if k in DEFAULT_SETTINGS})
    except Exception:
        pass
    if settings.get("idle_icon") in _RENAMED_VALUES:
        settings["idle_icon"] = _RENAMED_VALUES[settings["idle_icon"]]
    return settings


def save_settings(settings):
    try:
        STATUSBAR_DIR.mkdir(parents=True, exist_ok=True)
        tmp = SETTINGS_PATH.with_suffix(".{}.tmp".format(os.getpid()))
        with tmp.open("w", encoding="utf-8") as fh:
            json.dump(settings, fh, indent=2)
        os.replace(str(tmp), str(SETTINGS_PATH))
    except Exception:
        pass
