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
