"""Draws what the camera unit sees onto a frame.

Person boxes with their foot points, and every zone as a polygon colored by
its state (green empty, orange shared, red full) labeled "Table 1 1/4", the
same as the admin canvas. PIL only, no model imports, so the monitor
preview and the --fake --frame-file path can use it without ultralytics.
"""

from __future__ import annotations

import logging
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from status import STATE_COLORS, count_text, tile_state

log = logging.getLogger("camera-unit.overlay")

BOX_COLOR = (108, 192, 126)  # state-empty green
FOOT_COLOR = (236, 230, 218)  # foreground
FILL_ALPHA = 56  # 22 %
OUTLINE_WIDTH = 4
LABEL_BG = (20, 18, 15, 210)

_font_cache: dict[int, Any] = {}


def label_font(size: int):
    """A scalable mono font if one is available, else PIL's built-in bitmap font."""
    if size in _font_cache:
        return _font_cache[size]
    font = None
    for name in ("DejaVuSansMono-Bold.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans.ttf", "Arial.ttf"):
        try:
            font = ImageFont.truetype(name, size)
            break
        except OSError:
            continue
    if font is None:
        try:
            font = ImageFont.load_default(size=size)
        except TypeError:  # Pillow < 10.1 has no size argument
            font = ImageFont.load_default()
    _font_cache[size] = font
    return font


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def zone_label(name: str, zone_type: str, count: int, capacity: int | None) -> str:
    """Matches the admin canvas: "Table 3 1/4" for seating with a capacity, "Lounge 2" otherwise."""
    return f"{name} {count_text(zone_type, count, capacity)}"


def centroid(polygon: list[tuple[float, float]]) -> tuple[float, float]:
    n = max(1, len(polygon))
    return sum(p[0] for p in polygon) / n, sum(p[1] for p in polygon) / n


def draw_people(image: Image.Image, people: list[Any], radius: int = 7) -> None:
    """Box and foot point per person. people need .box and .foot."""
    draw = ImageDraw.Draw(image)
    for p in people:
        x1, y1, x2, y2 = p.box
        draw.rectangle((x1, y1, x2, y2), outline=BOX_COLOR, width=OUTLINE_WIDTH)
        fx, fy = p.foot
        # Keep the marker visible when the foot sits on the bottom edge.
        fy = min(fy, image.height - radius - 1)
        draw.ellipse((fx - radius, fy - radius, fx + radius, fy + radius), fill=FOOT_COLOR, outline=BOX_COLOR, width=2)


def draw_zones(image: Image.Image, zones: list[Any], counts: dict[str, int], font_size: int = 22) -> Image.Image:
    """Returns a new RGB image with each zone filled and outlined in its state
    color and labeled at its centroid. zones need .id, .name, .type, .capacity, .polygon."""
    base = image.convert("RGBA")
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for z in zones:
        if len(z.polygon) < 3:
            continue
        count = counts.get(z.id, 0)
        rgb = hex_rgb(STATE_COLORS[tile_state(z.type, count, z.capacity)])
        points = [(float(x), float(y)) for x, y in z.polygon]
        draw.polygon(points, fill=rgb + (FILL_ALPHA,))
        draw.line(points + [points[0]], fill=rgb + (255,), width=OUTLINE_WIDTH, joint="curve")
    out = Image.alpha_composite(base, layer)

    draw = ImageDraw.Draw(out, "RGBA")
    font = label_font(font_size)
    for z in zones:
        if len(z.polygon) < 3:
            continue
        text = zone_label(z.name, z.type, counts.get(z.id, 0), z.capacity)
        cx, cy = centroid(z.polygon)
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        w, h = right - left, bottom - top
        pad_x, pad_y = 12, 7
        draw.rectangle((cx - w / 2 - pad_x, cy - h / 2 - pad_y, cx + w / 2 + pad_x, cy + h / 2 + pad_y), fill=LABEL_BG)
        draw.text((cx - w / 2 - left, cy - h / 2 - top), text, font=font, fill=(255, 255, 255, 255))
    return out.convert("RGB")


def render_preview(image: Image.Image, people: list[Any], zones: list[Any], counts: dict[str, int]) -> Image.Image:
    """Everything the admin canvas shows, on the frame: zones by state, then people on top."""
    out = draw_zones(image, zones, counts)
    if people:
        draw_people(out, people)
    return out


def bgr_to_image(frame) -> Image.Image:
    """A BGR numpy frame (Picamera2 or OpenCV) as a PIL RGB image."""
    return Image.fromarray(frame[:, :, ::-1])
