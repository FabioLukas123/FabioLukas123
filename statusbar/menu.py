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
import sys
from pathlib import Path

from . import __version__, config, state, usage

REPO_ROOT = Path(__file__).resolve().parents[1]
SYSTEM_PY = "/usr/bin/python3"

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
#
# Positioning strategy: a Gtk.Menu popped from a 1x1 gtk-layer-shell window
# anchored to the TOP-RIGHT of the screen — i.e. right where the Waybar
# modules live — so the dropdown opens attached to the bar, deterministic on
# Wayland. (Waybar itself links gtk-layer-shell, so the library is present on
# every Waybar system.) Without layer-shell we fall back to the XWayland
# pointer popup, and only then to the launcher list.

def _show_gtk_menu():
    """Returns (ok, reason). *reason* names the exact failing step."""
    try:
        import gi
    except Exception:
        return False, "python-gobject ausente em {}".format(sys.executable)

    have_layer_shell = False
    if os.environ.get("WAYLAND_DISPLAY"):
        try:
            gi.require_version("GtkLayerShell", "0.1")
            have_layer_shell = True
            os.environ["GDK_BACKEND"] = "wayland"
        except Exception:
            os.environ.setdefault("GDK_BACKEND", "x11")
    else:
        os.environ.setdefault("GDK_BACKEND", "x11")

    try:
        gi.require_version("Gtk", "3.0")
        # pin Gdk too: with gtk4 installed, an unpinned Gdk import loads 4.0
        # first and then Gtk 3.0 conflicts ("Requiring namespace 'Gdk' 3.0…")
        gi.require_version("Gdk", "3.0")
        from gi.repository import Gdk, GLib, Gtk
        if have_layer_shell:
            from gi.repository import GtkLayerShell
    except Exception as exc:
        return False, "bindings GTK3 indisponíveis ({})".format(exc)
    if not Gtk.init_check([])[0]:
        return False, "display não inicializou (GDK_BACKEND={}, sem gtk-layer-shell={})".format(
            os.environ.get("GDK_BACKEND"), not have_layer_shell)

    # the original dropdown was dark; never render a white menu
    gtk_settings = Gtk.Settings.get_default()
    if gtk_settings:
        gtk_settings.set_property("gtk-application-prefer-dark-theme", True)

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

    if have_layer_shell:
        # invisible 1x1 anchor pinned to the top-right corner (the modules
        # area); the menu drops from it like a real bar dropdown
        anchor = Gtk.Window()
        anchor.set_default_size(1, 1)
        anchor.set_decorated(False)
        anchor.set_opacity(0.0)
        GtkLayerShell.init_for_window(anchor)
        GtkLayerShell.set_layer(anchor, GtkLayerShell.Layer.OVERLAY)
        GtkLayerShell.set_anchor(anchor, GtkLayerShell.Edge.TOP, True)
        GtkLayerShell.set_anchor(anchor, GtkLayerShell.Edge.RIGHT, True)
        GtkLayerShell.set_margin(anchor, GtkLayerShell.Edge.RIGHT, 8)

        def popup(*_a):
            menu.popup_at_widget(anchor.get_child() or anchor,
                                 Gdk.Gravity.SOUTH_EAST,
                                 Gdk.Gravity.NORTH_EAST, None)
            return False

        anchor.connect("map-event", lambda *_a: GLib.idle_add(popup))
        menu.connect("deactivate", lambda *_a: anchor.destroy())
        anchor.show_all()
    else:
        # X11 (XWayland) fallback: classic popup at pointer
        menu.popup(None, None, None, None, 0, Gtk.get_current_event_time())

    # safety: never leave a stray process if the menu loses its grab
    GLib.timeout_add_seconds(40, Gtk.main_quit)
    Gtk.main()
    return True, ""


def show():
    """Native GTK dropdown only — there is deliberately no launcher-window
    fallback. On failure it retries with the SYSTEM python (where pacman
    puts python-gobject; pyenv/conda interpreters never see it) and, if it
    still fails, notifies the exact reason instead of opening another UI."""
    ok, reason = _show_gtk_menu()
    if ok:
        return

    # bindings missing under this interpreter? re-exec with the system one
    if (
        "python-gobject" in reason
        and not os.environ.get("CSB_MENU_REEXEC")
        and os.path.exists(SYSTEM_PY)
        and os.path.realpath(SYSTEM_PY) != os.path.realpath(sys.executable or "")
    ):
        env = dict(os.environ, CSB_MENU_REEXEC="1", PYTHONPATH=str(REPO_ROOT))
        subprocess.run([SYSTEM_PY, "-m", "statusbar", "--menu"],
                       env=env, check=False)
        return

    if shutil.which("notify-send"):
        subprocess.run(
            ["notify-send", "-a", "Claude Status Bar", "Menu indisponível",
             "Motivo: {}\nDiagnóstico: python3 -m statusbar --menu-debug".format(
                 reason)],
            check=False)


def debug():
    """Print step-by-step diagnostics for the click menu."""
    print("interpretador:", sys.executable)
    print("repo:", REPO_ROOT)
    for var in ("WAYLAND_DISPLAY", "DISPLAY", "GDK_BACKEND", "XDG_SESSION_TYPE"):
        print("{}={}".format(var, os.environ.get(var)))
    try:
        import gi
        print("gi OK:", gi.__file__)
    except Exception as exc:
        print("gi FALHOU:", exc)
        if os.path.exists(SYSTEM_PY):
            print("-> teste com o python do sistema:",
                  "{} -m statusbar --menu-debug".format(SYSTEM_PY))
        return
    for name, ver in (("Gtk", "3.0"), ("GtkLayerShell", "0.1")):
        try:
            gi.require_version(name, ver)
            print("{} {} OK".format(name, ver))
        except Exception as exc:
            print("{} FALHOU: {}".format(name, exc))
    try:
        from gi.repository import Gtk
        print("Gtk.init_check:", Gtk.init_check([])[0])
    except Exception as exc:
        print("Gtk import/init FALHOU:", exc)


def notify():
    lines = usage.menu_lines(config.load_settings())
    body = "\n".join(lines) if lines else "Sem dados de uso ainda."
    if shutil.which("notify-send"):
        subprocess.run(["notify-send", "-a", "Claude Status Bar",
                        "Limites de uso", body], check=False)
    else:
        print(body)
