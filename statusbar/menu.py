"""Click-to-open settings menu for the Waybar modules.

Waybar modules have no dropdown, so clicking the Claude module runs
``python -m statusbar --menu``: a launcher-style menu via whichever of
rofi / wofi / fuzzel / zenity is installed. It shows the usage meters (the
same numbers as /status) and lets you switch animation, idle icon and the
toggles — settings land in ``~/.claude/statusbar/config.json`` and both the
Waybar pickers and the stream pick them up on their next tick.

``notify()`` (right-click) flashes the usage meters via notify-send.
Everything is stdlib + subprocess; missing launchers degrade gracefully.
"""

import shutil
import subprocess

from . import config, usage

ON, OFF = "●", "○"
CHECK_ON, CHECK_OFF = "[x]", "[ ]"
SEP = "─" * 34

ANIMATIONS = [("spark", "Claude Spark"), ("spinner", "Spinner"),
              ("clawd", "Crab Walking (Clawd)")]
IDLE_ICONS = [("clawd", "Clawd"), ("logo", "Claude logo"),
              ("clawd-sunglasses", "Clawd (óculos)"),
              ("clawd-headphones", "Clawd (fones)"),
              ("clawd-notebook", "Clawd (notebook)"),
              ("clawd-sleep", "Clawd (dormindo)")]
TOGGLES = [("show_timer", "Mostrar timer"),
           ("completion_sound", "Som ao concluir"),
           ("auto_poses", "Poses automáticas (Spotify/Cowork/sono)"),
           ("show_codex", "Ícone do Codex")]


def _run_menu(lines, prompt="Claude Status"):
    text = "\n".join(lines)
    candidates = [
        (["rofi", "-dmenu", "-i", "-p", prompt], text),
        (["wofi", "--dmenu", "--prompt", prompt], text),
        (["fuzzel", "--dmenu", "--prompt", prompt + " "], text),
        (["zenity", "--list", "--title", prompt, "--column", "Opção",
          "--width", "460", "--height", "560"] + lines, None),
    ]
    for cmd, stdin in candidates:
        if not shutil.which(cmd[0]):
            continue
        try:
            result = subprocess.run(
                cmd, input=stdin, text=True, capture_output=True, timeout=120)
            return (result.stdout or "").strip() or None
        except Exception:
            continue
    return None


def _build_lines(settings):
    lines = []
    for line in usage.menu_lines(settings) or ["(sem dados de uso ainda)"]:
        lines.append("  " + line)
    lines.append(SEP)
    for value, label in ANIMATIONS:
        mark = ON if settings.get("animation") == value else OFF
        lines.append("{} Animação: {}".format(mark, label))
    lines.append(SEP)
    for value, label in IDLE_ICONS:
        mark = ON if settings.get("idle_icon") == value else OFF
        lines.append("{} Ocioso: {}".format(mark, label))
    lines.append(SEP)
    for key, label in TOGGLES:
        mark = CHECK_ON if settings.get(key, True) else CHECK_OFF
        lines.append("{} {}".format(mark, label))
    return lines


def _apply(choice, settings):
    """Map a selected line back to a settings change; True when changed."""
    body = choice.lstrip("●○[x] ").strip()
    for value, label in ANIMATIONS:
        if body == "Animação: {}".format(label):
            settings["animation"] = value
            return True
    for value, label in IDLE_ICONS:
        if body == "Ocioso: {}".format(label):
            settings["idle_icon"] = value
            return True
    for key, label in TOGGLES:
        if body == label:
            settings[key] = not settings.get(key, True)
            return True
    return False


def show():
    settings = config.load_settings()
    choice = _run_menu(_build_lines(settings))
    if choice and _apply(choice, settings):
        config.save_settings(settings)


def notify():
    lines = usage.menu_lines(config.load_settings())
    body = "\n".join(lines) if lines else "Sem dados de uso ainda."
    if shutil.which("notify-send"):
        subprocess.run(["notify-send", "-a", "Claude Status Bar",
                        "Limites de uso", body], check=False)
    else:
        print(body)
