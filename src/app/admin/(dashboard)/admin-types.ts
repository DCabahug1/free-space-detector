import { demoDb } from "@/lib/demo-store";
import type { Building, Room } from "@/lib/types";

export interface UnitHeartbeat {
  id: string;
  name: string;
  last_seen: string | null;
  paused: boolean;
}

export interface AdminRoom extends Room {
  building: Building;
  zoneCount: number;
  units: UnitHeartbeat[];
}

export interface AdminUnit extends UnitHeartbeat {
  pair_code: string | null;
  room_id: string | null;
  // Short git hash the unit last reported, null before its first poll.
  version: string | null;
  // Set while an admin's update request waits for the unit's next poll.
  update_requested_at: string | null;
  room: { id: string; name: string; building: { id: string; name: string } } | null;
}

// Every camera unit with its area, oldest first. Server only.
export function loadAdminUnits(): AdminUnit[] {
  const db = demoDb();
  return [...db.units]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((u) => {
      const room = db.rooms.find((r) => r.id === u.room_id);
      const building = room && db.buildings.find((b) => b.id === room.building_id);
      return {
        id: u.id,
        name: u.name,
        pair_code: u.pair_code,
        room_id: u.room_id,
        last_seen: u.last_seen,
        paused: u.paused,
        version: u.version,
        update_requested_at: u.update_requested_at,
        room: room && building ? { id: room.id, name: room.name, building: { id: building.id, name: building.name } } : null,
      };
    });
}
