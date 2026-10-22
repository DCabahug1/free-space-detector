"""Shared status between the worker loop and the monitor. No tkinter here so
--fake and headless runs never import it."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any


# Hex versions of the dark theme tokens in docs/DESIGN.md, so the monitor,
# the overlay, the admin canvas, and the public map agree.
BG = "#262624"
FG = "#c3c0b6"
MUTED = "#b7b5a9"
BUTTON_BG = "#30302e"
BUTTON_ACTIVE = "#3e3e38"
ACCENT = "#70d5ed"
# The header band on every screen, as on the web pages.
BAND = "#0b5c8c"
BAND_2 = "#06314d"
BAND_FG = "#ffffff"
BAND_MUTED = "#bbd1e3"

STATE_COLORS = {
    "empty": "#6cc07e",
    "shared": "#e0a24a",
    "full": "#e2655a",
    "some": "#e0a24a",
    "busy": "#e2655a",
    "unknown": "#7d756b",
}

BUSY_FROM = 4


class CameraUnavailable(RuntimeError):
    """The camera is missing, unplugged, or stopped returning frames. main.py
    shows this on the monitor and retries instead of exiting. Lives here, not
    in detector.py, so main.py can catch it without importing ultralytics."""


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
    server_url: str = ""
    version: str = ""  # short git hash of the running code
    version_time: str = ""  # when that code was committed, for the Settings screen
    building_name: str = ""
    room_name: str = ""
    rows: list[ZoneRow] = field(default_factory=list)
    message: str = ""
    # Seconds since the epoch of the last successful post, 0 before the first.
    posted_at: float = 0.0
    # Number of people in the last frame and when it was captured.
    people: int = 0
    frame_at: float = 0.0
    stop: threading.Event = field(default_factory=threading.Event)
    # Set while counts and frames go to the server. Cleared by Pause sharing
    # on the monitor's Settings screen: the unit keeps counting for its own
    # screen and posts nothing, so the area reads offline after a minute.
    sharing: threading.Event = field(default_factory=lambda: _set_event())
    # Set by the monitor when sharing is toggled, so the worker reports the
    # new flag to the server at once instead of on the next zone refresh.
    resync: threading.Event = field(default_factory=threading.Event)
    # Camera preview popup on the monitor. The monitor sets preview_open while
    # the popup is up, and the worker renders the latest frame with boxes and
    # zones into preview only then, so the Pi does no extra work otherwise.
    preview_open: threading.Event = field(default_factory=threading.Event)
    preview: Any = None  # PIL RGB image, or None when nothing has been rendered yet
    # Set by the monitor's "Refresh zones" button. The worker re-fetches the
    # room and its zones right away instead of waiting for zone_refresh_s.
    refresh_zones: threading.Event = field(default_factory=threading.Event)
    # Set by the worker when the admin app asked for a code update. The
    # monitor runs the updater, the same as its Check for updates button.
    update_requested: threading.Event = field(default_factory=threading.Event)
    # Set by the monitor's "Update" button once new code has been pulled.
    # main.py re-executes itself after the monitor closes.
    restart: threading.Event = field(default_factory=threading.Event)


def _set_event() -> threading.Event:
    e = threading.Event()
    e.set()
    return e


def tile_state(zone_type: str, count: int, capacity: int | None) -> str:
    """Mirrors tileState in src/lib/occupancy.ts. Line zones count like open ones."""
    if count <= 0:
        return "empty"
    if zone_type == "seating":
        return "full" if capacity is not None and count >= capacity else "shared"
    return "busy" if count >= BUSY_FROM else "some"


def display_count(zone_type: str, count: int, capacity: int | None) -> int:
    """Mirrors displayCount in src/lib/occupancy.ts: a seating zone never shows more than its capacity."""
    if zone_type == "seating" and capacity:
        return min(count, capacity)
    return count


def count_text(zone_type: str, count: int, capacity: int | None) -> str:
    """"2/4" for seating with a capacity, "2" otherwise."""
    shown = display_count(zone_type, count, capacity)
    if zone_type == "seating" and capacity:
        return f"{shown}/{capacity}"
    return str(shown)


def tile_label(state: str, count: int = 0) -> str:
    return {
        "empty": "Empty",
        "shared": "Shared",
        "full": "Full",
        "some": "Some people",
        "busy": "Busy",
        "unknown": "Unknown",
    }[state]
