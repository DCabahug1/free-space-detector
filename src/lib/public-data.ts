import { bySortThenName, demoDb } from "@/lib/demo-store";
import type { PublicRoom, ZoneCount } from "@/lib/types";

// Rooms with their building, zones and camera unit heartbeats, plus the
// current counts. Used by the public map and the admin setup page. The
// public map filters to published rooms itself.

export interface PublicSnapshot {
  rooms: PublicRoom[];
  counts: ZoneCount[];
}

export function loadPublicSnapshot(filter?: { roomId?: string }): PublicSnapshot {
  const db = demoDb();
  const rooms: PublicRoom[] = db.rooms
    .filter((r) => !filter?.roomId || r.id === filter.roomId)
    .sort(bySortThenName)
    .flatMap((r) => {
      const building = db.buildings.find((b) => b.id === r.building_id);
      if (!building) return [];
      return [
        {
          ...r,
          building,
          zones: db.zones
            .filter((z) => z.room_id === r.id)
            .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
          units: db.units
            .filter((u) => u.room_id === r.id)
            .map((u) => ({ id: u.id, name: u.name, last_seen: u.last_seen, paused: u.paused })),
        },
      ];
    });
  const zoneIds = new Set(rooms.flatMap((r) => r.zones.map((z) => z.id)));
  const counts = [...db.counts.values()].filter((c) => zoneIds.has(c.zone_id));
  return { rooms, counts };
}
