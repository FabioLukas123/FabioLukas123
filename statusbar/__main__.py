"""Entry point: ``python -m statusbar [--waybar | --waybar-codex]``.

Default launches the system-tray app (needs pystray + Pillow). The Waybar
modes stream custom-module JSON to stdout and need only the standard
library — no tray, no extra icons on the bar.
"""

import sys


def main():
    args = sys.argv[1:]
    if "--waybar-codex" in args:
        from .waybar import codex_stream

        codex_stream()
    elif "--waybar" in args:
        from .waybar import claude_stream

        claude_stream()
    else:
        from .app import main as tray_main

        tray_main()


if __name__ == "__main__":
    main()
