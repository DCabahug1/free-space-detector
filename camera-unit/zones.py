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
