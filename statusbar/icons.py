"""Procedurally drawn tray icons — no binary assets required.

Everything is rendered with Pillow at runtime so the package stays tiny and the
icons scale cleanly. Frames are cached because the poll loop asks for them many
times a second.
"""

import math

from PIL import Image, ImageDraw

from . import config

_cache = {}


def _new(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def _spark_points(cx, cy, outer, inner, points=8, rotation=0.0):
    """Vertices of a sharp N-pointed starburst (the Claude 'spark')."""
    verts = []
    step = math.pi / points
    for i in range(points * 2):
        r = outer if i % 2 == 0 else inner
        ang = rotation + i * step
        verts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return verts


def spark(size=config.ICON_SIZE, color=config.CLAUDE_CORAL):
    """The resting Claude logo: a four-pointed coral starburst."""
    img, d = _new(size)
    cx = cy = size / 2
    outer = size * 0.46
    inner = size * 0.17
    d.polygon(_spark_points(cx, cy, outer, inner, points=4, rotation=0.0),
              fill=color + (255,))
    # A subtle secondary cross gives it the 8-point sparkle silhouette.
    d.polygon(_spark_points(cx, cy, outer * 0.62, inner * 0.7, points=4,
                            rotation=math.pi / 4), fill=color + (235,))
    return img


def spinner_frame(index, size=config.ICON_SIZE, color=config.CLAUDE_CORAL):
    """One frame of the working animation: a rotating ring of fading dots."""
    img, d = _new(size)
    cx = cy = size / 2
    radius = size * 0.32
    dot = max(2, int(size * 0.075))
    n = config.SPINNER_FRAMES
    for i in range(n):
        ang = 2 * math.pi * (i / n) - math.pi / 2
        # Fade each dot by how far it trails the leading (current) one.
        trail = (index - i) % n
        alpha = int(40 + 215 * (1 - trail / n))
        x = cx + radius * math.cos(ang)
        y = cy + radius * math.sin(ang)
        d.ellipse([x - dot, y - dot, x + dot, y + dot], fill=color + (alpha,))
    return img


def permission(size=config.ICON_SIZE, color=config.PERMISSION_AMBER):
    """A solid amber dot inside a soft ring — 'Claude needs you'."""
    img, d = _new(size)
    cx = cy = size / 2
    r_out = size * 0.42
    r_in = size * 0.26
    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out],
              fill=color + (70,))
    d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=color + (255,))
    return img


def done(size=config.ICON_SIZE, color=config.DONE_GREEN):
    """The spark with a green check badge to signal completion."""
    img = spark(size, config.CLAUDE_CORAL).copy()
    d = ImageDraw.Draw(img)
    # Check badge in the lower-right quadrant.
    bx, by = size * 0.66, size * 0.66
    br = size * 0.30
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=color + (255,))
    lw = max(2, int(size * 0.06))
    d.line(
        [(bx - br * 0.45, by + br * 0.02),
         (bx - br * 0.08, by + br * 0.40),
         (bx + br * 0.5, by - br * 0.42)],
        fill=(255, 255, 255, 255), width=lw, joint="curve",
    )
    return img


def for_state(state, frame=0, settings=None):
    """Return the icon image for an aggregate *state*.

    *frame* advances the working animation; *settings* selects colour/style.
    Results are cached on (state, frame, color, animation).
    """
    settings = settings or config.DEFAULT_SETTINGS
    base_color = (
        config.NEUTRAL_GREY if settings.get("color") == "system"
        else config.CLAUDE_CORAL
    )
    key = (state, frame, base_color, settings.get("animation"))
    if key in _cache:
        return _cache[key]

    if state == "permission":
        img = permission()
    elif state in ("thinking", "tool"):
        if settings.get("animation") == "spark":
            # Pulse the spark by gently rotating it.
            ang = 2 * math.pi * (frame / config.SPINNER_FRAMES) * 0.25
            img, d = _new(config.ICON_SIZE)
            cx = cy = config.ICON_SIZE / 2
            d.polygon(
                _spark_points(cx, cy, config.ICON_SIZE * 0.46,
                              config.ICON_SIZE * 0.17, 4, ang),
                fill=base_color + (255,),
            )
        else:
            img = spinner_frame(frame, color=base_color)
    elif state == "done":
        img = done()
    else:  # idle
        img = spark(color=base_color)

    _cache[key] = img
    return img
