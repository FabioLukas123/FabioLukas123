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
PY = sys.executable or "python3"

CLAUDE_EXEC = 'env PYTHONPATH={repo} {py} -m statusbar --waybar'.format(
    repo=REPO, py=PY)
CODEX_EXEC = 'env PYTHONPATH={repo} {py} -m statusbar --waybar-codex'.format(
    repo=REPO, py=PY)

MODULES = {
    "custom/claude": {
        "exec": CLAUDE_EXEC,
        "return-type": "json",
        "format": "{text}",
        "tooltip": True,
        "restart-interval": 5,
    },
    "custom/codex": {
        "exec": CODEX_EXEC,
        "return-type": "json",
        "format": "{text}",
        "restart-interval": 5,
    },
}

STYLE_MARK_BEGIN = "/* >>> claude-status-bar (managed block) >>> */"
STYLE_MARK_END = "/* <<< claude-status-bar <<< */"
STYLE_BLOCK = """{begin}
#custom-claude {{ color: #d97757; padding: 0 8px; }}
#custom-claude.permission {{ color: #f5c518; }}
#custom-claude.done {{ color: #5fb878; }}
#custom-codex {{ color: #c8ccd4; padding: 0 8px; }}
#custom-codex.working {{ color: #d97757; }}
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

    placed = any(
        m in bar.get(key, [])
        for key in ("modules-left", "modules-center", "modules-right")
        for m in MODULES
    )
    if not placed:
        right = bar.setdefault("modules-right", [])
        bar["modules-right"] = ["custom/claude", "custom/codex"] + list(right)
        notes.append("módulos adicionados ao início de modules-right")

    for key in ("modules-left", "modules-center", "modules-right"):
        mods = bar.get(key)
        if isinstance(mods, list) and "tray" in mods:
            bar[key] = [m for m in mods if m != "tray"]
            notes.append('módulo "tray" removido de {}'.format(key))
    bar.pop("tray", None)
    return notes


def patch_config(path):
    raw = path.read_text(encoding="utf-8")
    data = json.loads(strip_jsonc(raw))

    backup = path.with_name(path.name + ".claude-backup-{}".format(int(time.time())))
    shutil.copy2(path, backup)

    if isinstance(data, list):
        notes = patch_bar(data[0]) if data else []
    else:
        notes = patch_bar(data)

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8")
    return backup, notes


def patch_style(d):
    css = d / "style.css"
    text = css.read_text(encoding="utf-8") if css.is_file() else ""
    if STYLE_MARK_BEGIN in text:
        start = text.index(STYLE_MARK_BEGIN)
        end = text.index(STYLE_MARK_END) + len(STYLE_MARK_END)
        text = text[:start] + STYLE_BLOCK.strip() + text[end:]
    else:
        text = text.rstrip() + "\n\n" + STYLE_BLOCK
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
    d = waybar_dir()
    cfg = find_config(d)
    if cfg is None:
        print("! Config da Waybar não encontrada em {}.".format(d))
        print("  Snippets prontos estão em packaging/waybar/ para incluir manualmente.")
        sys.exit(1)
    try:
        backup, notes = patch_config(cfg)
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
    patch_style(d)
    print("✓ style.css: bloco de estilo aplicado/atualizado.")
    disable_tray_autostart()
    reload_waybar()
    print("Pronto — Clawd 🦀 e Codex aparecem na sua barra, sem o módulo tray.")


if __name__ == "__main__":
    main()
