"""Click menu for the Waybar modules — the native tray-style dropdown.

Clicking the Claude module runs ``python -m statusbar --menu``, which pops a
real GTK context menu at the cursor: the same layout as the original tray
dropdown — status headline, usage meters, per-session lines, check items and
radio submenus. No launcher window involved.

It runs through XWayland (``GDK_BACKEND=x11``) so the menu can position
itself at the pointer, which Wayland doesn't allow standalone apps to do;
XWayland is enabled by default on Hyprland/Sway. If GTK (python-gobject) is
missing it falls back to a rofi/wofi/fuzzel/zenity list, and ``notify()``
(right-click) always works via notify-send.

Settings changes persist to ``~/.claude/statusbar/config.json``; the Waybar
pickers/stream reread it on their next tick, so the bar updates immediately.
"""

import os
import shutil
import subprocess

from . import __version__, config, state, usage

ANIMATIONS = [("spark", "Claude Spark"), ("spinner", "Claude Code spinner"),
              ("clawd", "Crab Walking (Clawd)")]
IDLE_ICONS = [("clawd", "Clawd"), ("logo", "Claude logo"),
              ("clawd-sunglasses", "Clawd (sunglasses)"),
              ("clawd-headphones", "Clawd (headphones)"),
              ("clawd-notebook", "Clawd (notebook)"),
              ("clawd-sleep", "Clawd (sleeping)")]
TOGGLES = [("show_timer", "Show timer"),
           ("completion_sound", "Completion sound"),
           ("auto_poses", "Auto poses (Spotify / Cowork)"),
           ("show_codex", "Codex icon")]


def _headline(status):
    if status["count"] == 0:
        return "No active Claude sessions"
    st = status["state"]
    if st == "permission":
        n = status["waiting"]
        return "Awaiting permission ({} session{})".format(n, "" if n == 1 else "s")
    if st in ("thinking", "tool"):
        label = status["label"] or "Working"
        head = "{} · {}".format(status["project"], label) if status["project"] else label
        if status["elapsed"]:
            head += "  " + status["elapsed"]
        return head
    if st == "done":
        return "Done · {}".format(status["project"]) if status["project"] else "Done"
    return "Idle ({} session{})".format(status["count"], "" if status["count"] == 1 else "s")


# --- native GTK dropdown (the "first model" menu) ---------------------------

def _show_gtk_menu():
    # Position-at-pointer needs X11 semantics; XWayland provides them.
    os.environ.setdefault("GDK_BACKEND", "x11")
    try:
        import gi

        gi.require_version("Gtk", "3.0")
        from gi.repository import Gtk
    except Exception:
        return False
    if not Gtk.init_check([])[0]:
        return False

    settings = config.load_settings()
    sessions = state.read_sessions()
    status = state.aggregate(sessions)

    menu = Gtk.Menu()

    def add_info(text):
        item = Gtk.MenuItem(label=text)
        item.set_sensitive(False)
        menu.append(item)

    def add_sep():
        menu.append(Gtk.SeparatorMenuItem())

    def save_and_quit(*_a):
        config.save_settings(settings)
        Gtk.main_quit()

    add_info(_headline(status))
    for line in usage.menu_lines(settings):
        add_info(line)
    add_sep()

    if len(sessions) > 1:
        for s in sessions[:config.MAX_MENU_SESSIONS]:
            add_info(state.session_line(s))
        add_sep()

    for key, label in TOGGLES[:2]:  # Show timer, Completion sound
        check = Gtk.CheckMenuItem(label=label)
        check.set_active(bool(settings.get(key, True)))
        check.connect("toggled",
                      lambda w, k=key: (settings.__setitem__(k, w.get_active()),
                                        save_and_quit()))
        menu.append(check)

    def radio_submenu(title, options, setting_key):
        item = Gtk.MenuItem(label=title)
        sub = Gtk.Menu()
        group = None
        current = settings.get(setting_key)
        for value, label in options:
            radio = Gtk.RadioMenuItem(label=label, group=group)
            group = group or radio
            radio.set_active(current == value)
            radio.connect(
                "activate",
                lambda w, v=value: w.get_active() and (
                    settings.__setitem__(setting_key, v), save_and_quit()))
            sub.append(radio)
        item.set_submenu(sub)
        menu.append(item)

    radio_submenu("Animation", ANIMATIONS, "animation")
    radio_submenu("Idle icon", IDLE_ICONS, "idle_icon")

    for key, label in TOGGLES[2:]:  # Auto poses, Codex icon
        check = Gtk.CheckMenuItem(label=label)
        check.set_active(bool(settings.get(key, True)))
        check.connect("toggled",
                      lambda w, k=key: (settings.__setitem__(k, w.get_active()),
                                        save_and_quit()))
        menu.append(check)

    add_sep()
    add_info("Claude Status Bar v{}".format(__version__))

    menu.connect("deactivate", Gtk.main_quit)
    menu.show_all()
    # NULL position func = classic "popup at pointer"
    menu.popup(None, None, None, None, 0, Gtk.get_current_event_time())
    Gtk.main()
    return True


# --- launcher fallback (only when GTK is unavailable) -----------------------

ON, OFF = "●", "○"
CHECK_ON, CHECK_OFF = "[x]", "[ ]"
SEP = "─" * 34


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
    if _show_gtk_menu():
        return
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
