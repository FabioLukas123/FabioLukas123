"""Tray icons rendered from the original claude-status-bar assets.

The images shipped in ``statusbar/assets/`` are the ones embedded in the
upstream macOS app (m1ckc3s/claude-status-bar):

- ``logo.png``            the official Claude spark mark (60x60 alpha mask),
                          used as the resting icon
- ``spark/frame_*.png``   8 alpha-mask frames of the claude.ai thinking-spark
                          morphing animation
- ``clawd/frame_*.png``   20 full-colour frames of Clawd, the crab-walking
                          pixel-art animation (from Clawd-CrabWalking.gif)
- ``app.png``/``app.ico`` the app icon, converted from AppIcon.icns

Alpha masks are tinted at runtime (Claude orange or neutral "system" grey).
Clawd is full colour; in "system" colour mode it goes through a Python port of
the upstream ``adaptiveCrabFrame`` brightness->opacity mapping so the sprite
keeps its depth when drawn in a single ink colour. All frames are cached.
"""

from pathlib import Path

from PIL import Image, ImageDraw

from . import config

ASSETS_DIR = Path(__file__).resolve().parent / "assets"

SPARK_FRAME_COUNT = 8
CLAWD_FRAME_COUNT = 20

_cache = {}
_files = {}


def _load(relpath):
    """Load and cache a PNG asset as RGBA."""
    img = _files.get(relpath)
    if img is None:
        img = Image.open(ASSETS_DIR / relpath).convert("RGBA")
        _files[relpath] = img
    return img


def _square(img, size=config.ICON_SIZE):
    """Fit *img* onto a transparent square canvas of *size* px."""
    scale = min(size / img.width, size / img.height)
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    resized = img.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((size - w) // 2, (size - h) // 2))
    return canvas


def _tint(mask, color, size=config.ICON_SIZE):
    """Colour an alpha-mask asset: solid *color* carrying the mask's alpha."""
    mask = _square(mask, size)
    out = Image.new("RGBA", mask.size, color + (0,))
    out.putalpha(mask.getchannel("A"))
    return out


def _adaptive_clawd(src):
    """Port of upstream CrabRender.adaptiveCrabFrame for 'system' colour mode.

    Maps brightness to opacity so a single-ink rendering keeps the sprite's
    depth: the bright body stays solid, darker legs fade to partial ink, and
    the darkest pixels (eyes, outlines) drop out entirely as transparent
    holes. Thresholds are the upstream values, tuned by eye for this sprite.
    """
    dark_cut, body_level, gamma = 0.30, 0.54, 1.3
    ink = config.NEUTRAL_GREY
    src = src.convert("RGBA")
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    src_px = src.load()
    out_px = out.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = src_px[x, y]
            if a == 0:
                continue
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            if lum < dark_cut:
                continue  # eyes / outlines: transparent holes
            t = min(1.0, (lum - dark_cut) / (body_level - dark_cut))
            out_px[x, y] = ink + (int(a * (t ** gamma)),)
    return out


# --- state icons ---------------------------------------------------------

def logo(color=config.CLAUDE_CORAL, size=config.ICON_SIZE):
    """The resting icon: the official Claude spark mark, tinted."""
    return _tint(_load("logo.png"), color, size)


def spark_frame(index, color=config.CLAUDE_CORAL, size=config.ICON_SIZE):
    """One frame of the claude.ai thinking-spark morphing animation."""
    name = "spark/frame_{:02d}.png".format(index % SPARK_FRAME_COUNT)
    return _tint(_load(name), color, size)


def clawd_frame(index, adaptive=False, size=config.ICON_SIZE):
    """One frame of Clawd walking; *adaptive* applies the system-ink mapping."""
    name = "clawd/frame_{:02d}.png".format(index % CLAWD_FRAME_COUNT)
    img = _load(name)
    if adaptive:
        img = _adaptive_clawd(img)
    return _square(img, size)


def spinner_frame(index, color=config.CLAUDE_CORAL, size=config.ICON_SIZE):
    """Fallback drawn animation: a rotating ring of fading dots."""
    import math

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = size / 2
    radius = size * 0.32
    dot = max(2, int(size * 0.075))
    n = config.SPINNER_FRAMES
    for i in range(n):
        ang = 2 * math.pi * (i / n) - math.pi / 2
        trail = (index - i) % n
        alpha = int(40 + 215 * (1 - trail / n))
        x = cx + radius * math.cos(ang)
        y = cy + radius * math.sin(ang)
        d.ellipse([x - dot, y - dot, x + dot, y + dot], fill=color + (alpha,))
    return img


def permission(size=config.ICON_SIZE, color=config.PERMISSION_AMBER):
    """The upstream 'needs you' signal: a solid amber dot."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = size / 2
    r_out = size * 0.42
    r_in = size * 0.26
    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out],
              fill=color + (70,))
    d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=color + (255,))
    return img


def done(color=config.CLAUDE_CORAL, size=config.ICON_SIZE):
    """The spark logo with a green check badge to signal completion."""
    img = logo(color, size).copy()
    d = ImageDraw.Draw(img)
    bx, by = size * 0.70, size * 0.70
    br = size * 0.26
    d.ellipse([bx - br, by - br, bx + br, by + br],
              fill=config.DONE_GREEN + (255,))
    lw = max(2, int(size * 0.06))
    d.line(
        [(bx - br * 0.45, by + br * 0.02),
         (bx - br * 0.08, by + br * 0.40),
         (bx + br * 0.5, by - br * 0.42)],
        fill=(255, 255, 255, 255), width=lw, joint="curve",
    )
    return img


def frame_count(settings):
    """Number of frames in the currently selected working animation."""
    anim = (settings or {}).get("animation", "spark")
    if anim == "clawd":
        return CLAWD_FRAME_COUNT
    if anim == "spinner":
        return config.SPINNER_FRAMES
    return SPARK_FRAME_COUNT


def for_state(state, frame=0, settings=None):
    """Return the icon image for an aggregate *state*.

    *frame* is an unbounded counter; each animation wraps it by its own
    length. Results are cached on (state, wrapped frame, colour, animation).
    """
    settings = settings or config.DEFAULT_SETTINGS
    system = settings.get("color") == "system"
    base_color = config.NEUTRAL_GREY if system else config.CLAUDE_CORAL
    anim = settings.get("animation", "spark")

    if state in ("thinking", "tool"):
        frame = frame % frame_count(settings)
    else:
        frame = 0

    key = (state, frame, base_color, anim)
    if key in _cache:
        return _cache[key]

    if state == "permission":
        img = permission()
    elif state in ("thinking", "tool"):
        if anim == "clawd":
            img = clawd_frame(frame, adaptive=system)
        elif anim == "spinner":
            img = spinner_frame(frame, color=base_color)
        else:
            img = spark_frame(frame, color=base_color)
    elif state == "done":
        img = done(base_color)
    else:  # idle
        img = logo(base_color)

    _cache[key] = img
    return img
