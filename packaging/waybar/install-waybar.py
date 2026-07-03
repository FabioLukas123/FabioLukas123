#!/usr/bin/env python3
"""Wire the Claude/Codex modules into the user's Waybar config automatically.

Run via ../../setup.sh (or directly). What it does, idempotently:

1. Backs up ~/.config/waybar/config(.jsonc) and style.css.
2. Adds the "custom/claude" and "custom/codex" module definitions pointing
   at this checkout (absolute paths, current python3).
3. Puts them at the front of "modules-right" (creating it if needed) unless
   they are already placed somewhere.
4. Removes the "tray" module from the bar — it hosts every StatusNotifierItem
   on the system (flameshot, bluetooth, ...), which is exactly what we're
   replacing. The backup keeps the old layout if you want it back.
5. Appends a marked, idempotent style block to style.css.
6. Reloads Waybar (SIGUSR2).

The config is parsed as JSONC (comments and trailing commas are tolerated)
but written back as plain pretty-printed JSON — comments do not survive the
rewrite; that's what the backup is for.
"""

import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
# Prefer the SYSTEM python: pacman installs the GTK bindings (python-gobject)
# only there, and a pyenv/conda/venv interpreter would never see them.
PY = "/usr/bin/python3" if os.path.exists("/usr/bin/python3") else (
    sys.executable or "python3")

def _exec(flag):
    return 'env PYTHONPATH={repo} {py} -m statusbar {flag}'.format(
        repo=REPO, py=PY, flag=flag)


# image#… modules show the real Clawd/Codex artwork (baked PNG frames);
# custom/claude carries the text (action label, timer, permission) + tooltip.
MODULES = {
    "image#codex": {
        "exec": _exec("--waybar-icon-codex"),
        "size": 22,
        "interval": 1,
    },
    "image#claude": {
        "exec": _exec("--waybar-icon"),
        "size": 22,
        "interval": 1,
        "on-click": _exec("--menu"),
        "on-click-right": _exec("--usage-notify"),
    },
    "custom/claude": {
        "exec": _exec("--waybar"),
        "return-type": "json",
        "format": "{text}",
        "tooltip": True,
        "restart-interval": 5,
        "on-click": _exec("--menu"),
        "on-click-right": _exec("--usage-notify"),
    },
}
PLACEMENT = ["image#codex", "image#claude", "custom/claude"]
# modules written by older versions of this installer
LEGACY = ["custom/codex"]

STYLE_MARK_BEGIN = "/* >>> claude-status-bar (managed block) >>> */"
STYLE_MARK_END = "/* <<< claude-status-bar <<< */"
STYLE_BLOCK = """{begin}
#image {{ padding: 0 4px; }}
#custom-claude {{ color: #d97757; padding: 0 6px 0 0; }}
#custom-claude.permission {{ color: #f5c518; }}
#custom-claude.done {{ color: #5fb878; }}
{end}
""".format(begin=STYLE_MARK_BEGIN, end=STYLE_MARK_END)


def waybar_dir():
    return Path(os.environ.get("XDG_CONFIG_HOME",
                               str(Path.home() / ".config"))) / "waybar"


def find_config(d):
    for name in ("config.jsonc", "config", "config.json"):
        p = d / name
        if p.is_file():
            return p
    return None


def strip_jsonc(text):
    """Remove // and /* */ comments (string-aware), then trailing commas."""
    out = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    cleaned = "".join(out)
    cleaned = re.sub(r",(\s*[}\]])", r"\1", cleaned)
    return cleaned


def patch_bar(bar):
    """Mutate one bar dict; returns a list of human-readable change notes."""
    notes = []
    for name, definition in MODULES.items():
        if bar.get(name) != definition:
            bar[name] = definition
            notes.append("módulo {} configurado".format(name))
    for name in LEGACY:
        if bar.pop(name, None) is not None:
            notes.append("módulo legado {} removido".format(name))

    # normalise placement: strip our (and legacy) entries everywhere, then
    # put the current set at the front of modules-right, keeping order
    ours = set(PLACEMENT) | set(LEGACY)
    had_ours = False
    for key in ("modules-left", "modules-center", "modules-right"):
        mods = bar.get(key)
        if isinstance(mods, list):
            kept = [m for m in mods if m not in ours]
            had_ours = had_ours or len(kept) != len(mods)
            bar[key] = kept
    right = bar.get("modules-right") or []
    bar["modules-right"] = list(PLACEMENT) + list(right)
    if not had_ours:
        notes.append("módulos adicionados ao início de modules-right")

    for key in ("modules-left", "modules-center", "modules-right"):
        mods = bar.get(key)
        if isinstance(mods, list) and "tray" in mods:
            bar[key] = [m for m in mods if m != "tray"]
            notes.append('módulo "tray" removido de {}'.format(key))
    bar.pop("tray", None)
    return notes


def restore_tray_bar(bar):
    """Undo the custom modules and bring the classic tray module back."""
    notes = []
    ours = set(MODULES) | set(LEGACY)
    for name in ours:
        if bar.pop(name, None) is not None:
            notes.append("módulo {} removido".format(name))
    for key in ("modules-left", "modules-center", "modules-right"):
        mods = bar.get(key)
        if isinstance(mods, list):
            bar[key] = [m for m in mods if m not in ours]
    placed = any("tray" in (bar.get(k) or [])
                 for k in ("modules-left", "modules-center", "modules-right"))
    if not placed:
        bar["modules-right"] = ["tray"] + list(bar.get("modules-right") or [])
        notes.append('módulo "tray" restaurado em modules-right')
    bar.setdefault("tray", {"spacing": 10})
    return notes


def patch_config(path, patcher=patch_bar):
    raw = path.read_text(encoding="utf-8")
    data = json.loads(strip_jsonc(raw))

    backup = path.with_name(path.name + ".claude-backup-{}".format(int(time.time())))
    shutil.copy2(path, backup)

    if isinstance(data, list):
        notes = patcher(data[0]) if data else []
    else:
        notes = patcher(data)

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8")
    return backup, notes


def patch_style(d, remove=False):
    css = d / "style.css"
    text = css.read_text(encoding="utf-8") if css.is_file() else ""
    if STYLE_MARK_BEGIN in text:
        start = text.index(STYLE_MARK_BEGIN)
        end = text.index(STYLE_MARK_END) + len(STYLE_MARK_END)
        replacement = "" if remove else STYLE_BLOCK.strip()
        text = (text[:start] + replacement + text[end:]).strip() + "\n"
    elif not remove:
        text = text.rstrip() + "\n\n" + STYLE_BLOCK
    else:
        return
    css.write_text(text, encoding="utf-8")


def disable_tray_autostart():
    """The Waybar module replaces the tray app; stop its autostart if set."""
    subprocess.run(
        ["systemctl", "--user", "disable", "--now", "claude-status-bar.service"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    desktop = (Path(os.environ.get("XDG_CONFIG_HOME",
                                   str(Path.home() / ".config")))
               / "autostart" / "claude-status-bar.desktop")
    try:
        desktop.unlink()
        print("• Autostart do app de bandeja removido (substituído pelo módulo Waybar).")
    except FileNotFoundError:
        pass


def reload_waybar():
    try:
        subprocess.run(["pkill", "-SIGUSR2", "waybar"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       check=False)
        print("• Waybar recarregada (SIGUSR2).")
    except Exception:
        pass


def main():
    restore = "--restore-tray" in sys.argv[1:]
    d = waybar_dir()
    cfg = find_config(d)
    if cfg is None:
        print("! Config da Waybar não encontrada em {}.".format(d))
        print("  Snippets prontos estão em packaging/waybar/ para incluir manualmente.")
        sys.exit(1)
    try:
        backup, notes = patch_config(
            cfg, restore_tray_bar if restore else patch_bar)
    except Exception as exc:
        print("! Não consegui editar {} com segurança: {}".format(cfg, exc))
        print("  Nada foi alterado.")
        sys.exit(1)
    print("✓ {} atualizado (backup: {}).".format(cfg.name, backup.name))
    for n in notes:
        print("  - " + n)
    if not notes:
        print("  - já estava configurado; nada a fazer")
    print("  (comentários do JSONC não são preservados — o backup guarda o original)")
    patch_style(d, remove=restore)
    if restore:
        print("✓ style.css: bloco custom removido.")
        reload_waybar()
        print("Pronto — módulo tray restaurado; o app de bandeja mostra o menu padrão.")
    else:
        print("✓ style.css: bloco de estilo aplicado/atualizado.")
        disable_tray_autostart()
        reload_waybar()
        print("Pronto — Clawd 🦀 e Codex aparecem na sua barra, sem o módulo tray.")


if __name__ == "__main__":
    main()
