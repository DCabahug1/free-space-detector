"""Zone loading and per-zone counting.

Zones come from Supabase REST with the anon key. RLS lets anon read zones of
published rooms, so no secret is needed here. Polygons are [x, y] pairs in
frame pixels (1280x720 by default), matching what the admin app draws.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field


@dataclass
class Zone:
    id: str
    name: str
    type: str  # seating | open (line is deprecated, still counted if present)
    capacity: int | None
    polygon: list[tuple[float, float]]


@dataclass
class ZoneCounter:
    """Turns foot points into a count per zone.

    Counts are live by default (dwell_s=0): a person leaves, the spot is
    free. With dwell_s > 0 a seating zone keeps its last nonzero count for
    that many seconds after the last person leaves. Line and open zones
    always report the live count.
    """

    dwell_s: float
    last_nonzero: dict[str, tuple[int, float]] = field(default_factory=dict)

    def count(self, zones: list[Zone], feet: list[tuple[float, float]], now: float | None = None) -> dict[str, int]:
        now = time.time() if now is None else now
        result: dict[str, int] = {}
        for zone in zones:
            live = sum(1 for p in feet if point_in_polygon(p, zone.polygon))
            if zone.type == "seating":
                if live > 0:
                    self.last_nonzero[zone.id] = (live, now)
                    result[zone.id] = live
                else:
                    held = self.last_nonzero.get(zone.id)
                    if held and now - held[1] < self.dwell_s:
                        result[zone.id] = held[0]
                    else:
                        self.last_nonzero.pop(zone.id, None)
                        result[zone.id] = 0
            else:
                result[zone.id] = live
        return result


@dataclass
class Confirmer:
    """Holds a count change until it has stayed the same for confirm_s
    seconds and confirm_frames frames, per zone, so a person walking past or
    one missed detection never flips a tile. The stable counts are what the
    monitor shows and what gets posted. A zone seen for the first time is
    taken as is, so boot does not wait."""

    confirm_s: float
    confirm_frames: int = 1
    stable: dict[str, int] = field(default_factory=dict)
    candidate: dict[str, tuple[int, float, int]] = field(default_factory=dict)  # value, since, frames

    def update(self, latest: dict[str, int], now: float | None = None) -> tuple[dict[str, int], bool]:
        """Returns (stable counts, whether any zone just changed)."""
        now = time.time() if now is None else now
        changed = False
        for zone_id, value in latest.items():
            if zone_id not in self.stable:
                self.stable[zone_id] = value
                changed = True
                continue
            if value == self.stable[zone_id]:
                self.candidate.pop(zone_id, None)
                continue
            held = self.candidate.get(zone_id)
            if held is None or held[0] != value:
                held = (value, now, 1)
            else:
                held = (value, held[1], held[2] + 1)
            self.candidate[zone_id] = held
            if now - held[1] >= self.confirm_s and held[2] >= self.confirm_frames:
                self.stable[zone_id] = value
                self.candidate.pop(zone_id, None)
                changed = True
        # Zones that disappeared (deleted in the admin app) drop out.
        for zone_id in list(self.stable):
            if zone_id not in latest:
                del self.stable[zone_id]
                self.candidate.pop(zone_id, None)
        return dict(self.stable), changed


def point_in_polygon(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    """Ray casting test. Points on an edge count as inside often enough for us."""
    if len(polygon) < 3:
        return False
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        crosses = (yi > y) != (yj > y)
        if crosses:
            x_at_y = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < x_at_y:
                inside = not inside
        j = i
    return inside


def fetch_zones(supabase_url: str, anon_key: str, room_id: str, timeout: float = 10) -> list[Zone]:
    params = urllib.parse.urlencode(
        {
            "select": "id,name,type,capacity,polygon",
            "room_id": f"eq.{room_id}",
            "order": "created_at.asc",
        }
    )
    url = f"{supabase_url}/rest/v1/zones?{params}"
    req = urllib.request.Request(
        url,
        headers={"apikey": anon_key, "Authorization": f"Bearer {anon_key}"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        rows = json.loads(resp.read().decode())

    zones: list[Zone] = []
    for row in rows:
        polygon = [(float(p[0]), float(p[1])) for p in (row.get("polygon") or []) if len(p) >= 2]
        zones.append(
            Zone(
                id=row["id"],
                name=row["name"],
                type=row["type"],
                capacity=row.get("capacity"),
                polygon=polygon,
            )
        )
    return zones
