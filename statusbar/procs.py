"""Lightweight process detection for the automatic poses (no psutil needed).

The running-process name list is cached for a few seconds so the 0.2s poll
loop never spawns snapshots at frame rate. All helpers fail soft: on any
error the answer is simply "not running".
"""

import os
import time

_CACHE_TTL = 5.0
_cache = {"at": 0.0, "names": frozenset()}


def _names_linux():
    names = set()
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            with open("/proc/{}/comm".format(pid), "r") as fh:
                names.add(fh.read().strip().lower())
        except Exception:
            continue
    return names


def _names_windows():
    import ctypes
    from ctypes import wintypes

    TH32CS_SNAPPROCESS = 0x00000002

    class PROCESSENTRY32(ctypes.Structure):
        _fields_ = [
            ("dwSize", wintypes.DWORD),
            ("cntUsage", wintypes.DWORD),
            ("th32ProcessID", wintypes.DWORD),
            ("th32DefaultHeapID", ctypes.POINTER(ctypes.c_ulong)),
            ("th32ModuleID", wintypes.DWORD),
            ("cntThreads", wintypes.DWORD),
            ("th32ParentProcessID", wintypes.DWORD),
            ("pcPriClassBase", ctypes.c_long),
            ("dwFlags", wintypes.DWORD),
            ("szExeFile", ctypes.c_char * 260),
        ]

    k32 = ctypes.windll.kernel32
    snap = k32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
    names = set()
    if snap in (0, -1):
        return names
    try:
        entry = PROCESSENTRY32()
        entry.dwSize = ctypes.sizeof(PROCESSENTRY32)
        if k32.Process32First(snap, ctypes.byref(entry)):
            while True:
                names.add(entry.szExeFile.decode("utf-8", "ignore").lower())
                if not k32.Process32Next(snap, ctypes.byref(entry)):
                    break
    finally:
        k32.CloseHandle(snap)
    return names


def running_names():
    """Cached set of lowercase process names currently running."""
    now = time.monotonic()
    if now - _cache["at"] > _CACHE_TTL:
        try:
            names = _names_windows() if os.name == "nt" else _names_linux()
        except Exception:
            names = set()
        _cache["at"] = now
        _cache["names"] = frozenset(names)
    return _cache["names"]


def process_running(candidates):
    names = running_names()
    return any(c.lower() in names for c in candidates)


def spotify_running():
    # /proc comm is truncated to 15 chars on Linux; "spotify" fits fine.
    return process_running(("spotify.exe", "spotify"))


def claude_desktop_running():
    return process_running(("claude.exe",))
