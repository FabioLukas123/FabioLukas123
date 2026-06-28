"""Tiny cross-platform completion chime (best-effort, never raises)."""

import os
import shutil
import subprocess


def play_done():
    try:
        if os.name == "nt":
            import winsound

            winsound.MessageBeep(winsound.MB_ICONASTERISK)
            return
        # Linux: try the freedesktop sound theme via whatever player exists.
        for player, args in (
            ("canberra-gtk-play", ["-i", "complete"]),
            ("paplay", ["/usr/share/sounds/freedesktop/stereo/complete.oga"]),
            ("aplay", ["/usr/share/sounds/alsa/Front_Center.wav"]),
        ):
            if shutil.which(player):
                subprocess.Popen(
                    [player] + args,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return
    except Exception:
        pass
