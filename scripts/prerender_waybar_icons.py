#!/usr/bin/env python3
"""Bake every tray icon frame to PNG files for Waybar's ``image`` module.

Waybar custom modules are text-only; its ``image`` module displays a PNG from
a path. This bakes all frames (using the exact same renderer as the tray app)
into ``statusbar/assets/waybar/``, so the runtime picker
(``python -m statusbar --waybar-icon``) needs only the standard library.

The baked files are committed to the repo — run this again only after
changing artwork. Requires Pillow.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from PIL import Image  # noqa: E402

from statusbar import config, icons  # noqa: E402

OUT = ROOT / "statusbar" / "assets" / "waybar"
OUT.mkdir(parents=True, exist_ok=True)

BASE = dict(config.DEFAULT_SETTINGS)
BASE.update(color="orange", status_badge=False)
BADGED = dict(BASE, status_badge=True)


def save(img, name):
    img.save(OUT / (name + ".png"))


def main():
    count = 0

    # resting icons: the Claude logo + every Clawd pose
    save(icons.logo(), "claude_idle_logo"); count += 1
    for pose in icons.POSES:
        save(icons.pose(pose), "claude_idle_{}".format(pose)); count += 1

    # working animations (badge-less: the adjacent text carries the label)
    for i in range(icons.SPARK_FRAME_COUNT):
        save(icons.spark_frame(i), "claude_work_spark_{}".format(i)); count += 1
    for i in range(icons.CLAWD_FRAME_COUNT):
        save(icons.clawd_frame(i), "claude_work_clawd_{}".format(i)); count += 1
    for i in range(config.SPINNER_FRAMES):
        save(icons.spinner_frame(i), "claude_work_spinner_{}".format(i)); count += 1

    # Cowork: Clawd at the notebook, 2-phase bob
    save(icons.for_state("tool", 0, BASE, override_pose="clawd-notebook"),
         "claude_work_notebook_0"); count += 1
    save(icons.for_state("tool", 3, BASE, override_pose="clawd-notebook"),
         "claude_work_notebook_1"); count += 1

    # permission: Clawd + blinking amber "!" (2 phases), and done
    save(icons.for_state("permission", 0, BADGED), "claude_permission_0"); count += 1
    save(icons.for_state("permission", 3, BADGED), "claude_permission_1"); count += 1
    save(icons.for_state("done", 0, BASE), "claude_done"); count += 1

    # Codex glyphs in two inks: light (dark bars) and dark (light bars)
    inks = {"light": icons.CODEX_INK, "dark": (62, 64, 72)}
    for ink_name, ink in inks.items():
        for st, frames in (("idle", [0]), ("work", [0, 1, 2])):
            for f in frames:
                mask = icons._load(
                    "codex/idle.png" if st == "idle"
                    else "codex/work_{}.png".format(f + 1))
                img = icons._tint(mask, ink)
                name = ("codex_{}_idle".format(ink_name) if st == "idle"
                        else "codex_{}_work_{}".format(ink_name, f))
                save(img, name); count += 1

    # fully transparent placeholder shown while Codex is not running
    save(Image.new("RGBA", (1, 1), (0, 0, 0, 0)), "off"); count += 1

    print("baked {} PNGs into {}".format(count, OUT))


if __name__ == "__main__":
    main()
