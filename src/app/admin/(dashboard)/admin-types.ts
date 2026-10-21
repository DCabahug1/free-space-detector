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
  room: { id: string; name: string; building: { name: string } } | null;
}
