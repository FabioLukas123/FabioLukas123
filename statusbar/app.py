"""The system-tray application.

Runs a tiny poll loop on a background thread that reads the per-session state
files, aggregates them, animates the tray icon, and keeps the dropdown menu in
sync. Works on Arch Linux (AppIndicator/GTK backend) and Windows (native Win32
tray) via pystray.
"""

import threading
import time
import webbrowser

import pystray
from pystray import Menu, MenuItem

from . import __version__, config, icons, sound, state


class StatusBarApp:
    def __init__(self):
        self.settings = config.load_settings()
        self.sessions = []
        self.status = state.aggregate([])
        self._frame = 0
        self._prev_state = "idle"
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self.icon = pystray.Icon(
            "claude-status-bar",
            icon=icons.for_state("idle", settings=self.settings),
            title="Claude Status Bar",
            menu=self._build_menu(),
        )

    # -- menu -----------------------------------------------------------------
    def _build_menu(self):
        # Fixed session slots whose text/visibility are evaluated on each
        # update_menu(); this lets a variable number of sessions appear without
        # rebuilding the Menu object.
        session_items = [
            MenuItem(
                self._session_text(i),
                None,
                enabled=False,
                visible=self._session_visible(i),
            )
            for i in range(config.MAX_MENU_SESSIONS)
        ]

        return Menu(
            MenuItem(self._headline_text, None, enabled=False),
            Menu.SEPARATOR,
            *session_items,
            Menu.SEPARATOR,
            MenuItem(
                "Show timer",
                self._toggle("show_timer"),
                checked=lambda _i: self.settings.get("show_timer", True),
            ),
            MenuItem(
                "Completion sound",
                self._toggle("completion_sound"),
                checked=lambda _i: self.settings.get("completion_sound", True),
            ),
            MenuItem(
                "Animation",
                Menu(
                    MenuItem(
                        "Claude Spark",
                        self._set_animation("spark"),
                        checked=lambda _i: self.settings.get("animation") == "spark",
                        radio=True,
                    ),
                    MenuItem(
                        "Claude Code spinner",
                        self._set_animation("spinner"),
                        checked=lambda _i: self.settings.get("animation") == "spinner",
                        radio=True,
                    ),
                    MenuItem(
                        "Crab Walking (Clawd)",
                        self._set_animation("clawd"),
                        checked=lambda _i: self.settings.get("animation") == "clawd",
                        radio=True,
                    ),
                ),
            ),
            MenuItem(
                "Icon colour",
                Menu(
                    MenuItem(
                        "Claude orange",
                        self._set_color("orange"),
                        checked=lambda _i: self.settings.get("color") == "orange",
                        radio=True,
                    ),
                    MenuItem(
                        "System",
                        self._set_color("system"),
                        checked=lambda _i: self.settings.get("color") == "system",
                        radio=True,
                    ),
                ),
            ),
            Menu.SEPARATOR,
            MenuItem("Open state folder", self._open_state_folder),
            MenuItem("Claude Status Bar v{}".format(__version__), None, enabled=False),
            MenuItem("Quit", self._quit),
        )

    def _headline_text(self, _item=None):
        s = self.status
        if s["count"] == 0:
            return "No active Claude sessions"
        if s["state"] == "permission":
            n = s["waiting"]
            return "Awaiting permission ({} session{})".format(n, "" if n == 1 else "s")
        if s["state"] in ("thinking", "tool"):
            label = s["label"] or "Working"
            project = s["project"] or ""
            elapsed = "  {}".format(s["elapsed"]) if s["elapsed"] else ""
            head = "{} · {}{}".format(project, label, elapsed) if project else label + elapsed
            return head
        if s["state"] == "done":
            return "Done · {}".format(s["project"]) if s["project"] else "Done"
        return "Idle ({} session{})".format(s["count"], "" if s["count"] == 1 else "s")

    def _session_text(self, index):
        def text(_item=None):
            with self._lock:
                if index < len(self.sessions):
                    return state.session_line(self.sessions[index])
            return ""
        return text

    def _session_visible(self, index):
        def visible(_item=None):
            with self._lock:
                # Only show the per-session rows when more than one session is
                # active; a single session is already summarised in the header.
                return len(self.sessions) > 1 and index < len(self.sessions)
        return visible

    # -- menu actions ---------------------------------------------------------
    def _toggle(self, key):
        def handler(_icon=None, _item=None):
            self.settings[key] = not self.settings.get(key, True)
            config.save_settings(self.settings)
            self.icon.update_menu()
        return handler

    def _set_animation(self, value):
        def handler(_icon=None, _item=None):
            self.settings["animation"] = value
            config.save_settings(self.settings)
            self.icon.update_menu()
        return handler

    def _set_color(self, value):
        def handler(_icon=None, _item=None):
            self.settings["color"] = value
            config.save_settings(self.settings)
            self.icon.update_menu()
        return handler

    def _open_state_folder(self, _icon=None, _item=None):
        try:
            config.STATE_DIR.mkdir(parents=True, exist_ok=True)
            webbrowser.open(config.STATE_DIR.as_uri())
        except Exception:
            pass

    def _quit(self, _icon=None, _item=None):
        self._stop.set()
        self.icon.stop()

    # -- poll loop ------------------------------------------------------------
    def _poll_loop(self):
        last_menu_refresh = 0.0
        while not self._stop.is_set():
            try:
                sessions = state.read_sessions()
                status = state.aggregate(sessions)
                with self._lock:
                    self.sessions = sessions
                    self.status = status

                # Completion chime on the idle/working -> done transition.
                if (
                    status["state"] == "done"
                    and self._prev_state != "done"
                    and self.settings.get("completion_sound", True)
                ):
                    sound.play_done()
                self._prev_state = status["state"]

                # Advance + render the icon. The counter is unbounded; each
                # animation wraps it by its own frame count inside icons.
                if status["state"] in ("thinking", "tool"):
                    self._frame += 1
                else:
                    self._frame = 0
                self.icon.icon = icons.for_state(
                    status["state"], self._frame, self.settings
                )
                self.icon.title = self._tooltip(status)

                # Refresh the dropdown labels about once a second.
                now = time.monotonic()
                if now - last_menu_refresh > 1.0:
                    self.icon.update_menu()
                    last_menu_refresh = now
            except Exception:
                pass
            self._stop.wait(config.POLL_INTERVAL)

    def _tooltip(self, status):
        if status["count"] == 0:
            return "Claude Status Bar — idle"
        if status["state"] == "permission":
            return "Claude needs you — {} waiting".format(status["waiting"])
        if status["state"] in ("thinking", "tool"):
            base = status["label"] or "Working"
            if status["elapsed"]:
                base = "{} · {}".format(base, status["elapsed"])
            if status["project"]:
                base = "{} — {}".format(status["project"], base)
            return base
        if status["state"] == "done":
            return "Done — {}".format(status["project"]) if status["project"] else "Done"
        return "Claude Status Bar — {} session(s)".format(status["count"])

    # -- lifecycle ------------------------------------------------------------
    def _setup(self, icon):
        icon.visible = True
        thread = threading.Thread(target=self._poll_loop, daemon=True)
        thread.start()

    def run(self):
        self.icon.run(setup=self._setup)


def main():
    StatusBarApp().run()


if __name__ == "__main__":
    main()
