"""Completion chime — plays the original app's completion.mp3 (best-effort).

Falls back to a system beep/theme sound when no mp3-capable player is
available. Never raises.
"""

import os
import shutil
import subprocess
from pathlib import Path

COMPLETION_MP3 = Path(__file__).resolve().parent / "assets" / "completion.mp3"


def _play_windows(path):
    # System.Windows.Media.MediaPlayer handles mp3 without any UI. The
    # Start-Sleep keeps the process alive until playback finishes.
    ps = (
        "Add-Type -AssemblyName PresentationCore; "
        "$p = New-Object System.Windows.Media.MediaPlayer; "
        "$p.Open([Uri]'{}'); $p.Play(); Start-Sleep -Seconds 3"
    ).format(path.as_posix())
    subprocess.Popen(
        ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=0x08000000,  # CREATE_NO_WINDOW
    )


def _play_linux(path):
    for player, args in (
        ("mpv", ["--no-video", "--really-quiet", str(path)]),
        ("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", str(path)]),
        ("mpg123", ["-q", str(path)]),
        ("cvlc", ["--play-and-exit", "--intf", "dummy", str(path)]),
    ):
        if shutil.which(player):
            subprocess.Popen(
                [player] + args,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return True
    return False


def _fallback_beep():
    if os.name == "nt":
        import winsound

        winsound.MessageBeep(winsound.MB_ICONASTERISK)
        return
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


def play_done():
    try:
        if COMPLETION_MP3.exists():
            if os.name == "nt":
                _play_windows(COMPLETION_MP3)
                return
            if _play_linux(COMPLETION_MP3):
                return
        _fallback_beep()
    except Exception:
        pass
