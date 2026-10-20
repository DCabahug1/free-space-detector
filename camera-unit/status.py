"""Shared status between the worker loop and the monitor. No tkinter here so
--fake and headless runs never import it."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field


STATE_COLORS = {
    "empty": "#22c55e",
    "shared": "#f59e0b",
    "full": "#ef4444",
    "some": "#f59e0b",
    "busy": "#ef4444",
    "line": "#38bdf8",
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


def tile_state(zone_type: str, count: int, capacity: int | None) -> str:
    """Mirrors src/lib/occupancy.ts so the monitor agrees with the public map."""
    if zone_type == "line":
        return "line"
    if count <= 0:
        return "empty"
    if zone_type == "seating":
        return "full" if capacity is not None and count >= capacity else "shared"
    return "busy" if count >= 4 else "some"


def tile_label(state: str, count: int) -> str:
    if state == "line":
        if count == 0:
            return "No line"
        minutes = max(1, round(count * 45 / 60))
        return f"{count} waiting, about {minutes} min"
    return {"empty": "Empty", "shared": "Shared", "full": "Full", "some": "Some people", "busy": "Busy"}[state]
