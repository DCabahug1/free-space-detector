"""Shared status between the worker loop and the monitor. No tkinter here so
--fake and headless runs never import it."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any


# Hex versions of the --state-* dark theme tokens in src/app/globals.css, so
# the monitor, the overlay, the admin canvas, and the public map agree.
STATE_COLORS = {
    "empty": "#4cb86a",
    "shared": "#ed9e2f",
    "full": "#d74843",
    "some": "#ed9e2f",
    "busy": "#d74843",
    "line": "#48a1db",
}


@dataclass
class ZoneRow:
    name: str
    type: str
    capacity: int | None
    count: int


@dataclass
class Status:
    """Shared between the worker thread (writes) and the monitor (reads)."""

    mode: str = "starting"  # starting | pairing | live
    pair_code: str = ""
    pair_url: str = ""
    unit_name: str = ""
    room_name: str = ""
    rows: list[ZoneRow] = field(default_factory=list)
    message: str = ""
    stop: threading.Event = field(default_factory=threading.Event)
    # Camera preview popup on the monitor. The monitor sets preview_open while
    # the popup is up, and the worker renders the latest frame with boxes and
    # zones into preview only then, so the Pi does no extra work otherwise.
    preview_open: threading.Event = field(default_factory=threading.Event)
    preview: Any = None  # PIL RGB image, or None when nothing has been rendered yet
    # Set by the monitor's "Refresh zones" button. The worker re-fetches the
    # room and its zones right away instead of waiting for zone_refresh_s.
    refresh_zones: threading.Event = field(default_factory=threading.Event)


def tile_state(zone_type: str, count: int, capacity: int | None) -> str:
    """Mirrors src/lib/occupancy.ts so the monitor agrees with the public map."""
    if zone_type == "line":
        return "line"
    if count <= 0:
        return "empty"
    if zone_type == "seating":
        return "full" if capacity is not None and count >= capacity else "shared"
    return "busy" if count >= 4 else "some"


def display_count(zone_type: str, count: int, capacity: int | None) -> int:
    """Mirrors displayCount in src/lib/occupancy.ts: a seating zone never shows more than its capacity."""
    if zone_type == "seating" and capacity:
        return min(count, capacity)
    return count


def tile_label(state: str, count: int) -> str:
    if state == "line":
        if count == 0:
            return "No line"
        minutes = max(1, round(count * 45 / 60))
        return f"{count} waiting, about {minutes} min"
    return {"empty": "Empty", "shared": "Shared", "full": "Full", "some": "Some people", "busy": "Busy"}[state]
