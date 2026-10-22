// "line" is deprecated. New zones cannot be created with it. Rows that still
// have it are counted and rendered like an open zone.
export type ZoneType = "seating" | "line" | "open";

// Polygon vertices in frame pixels, [x, y].
export type Polygon = [number, number][];

export interface Building {
  id: string;
  name: string;
  slug: string;
  // Set by staff in the admin building dialog. Both null until then.
  lat: number | null;
  lng: number | null;
}

export interface Room {
  id: string;
  building_id: string;
  name: string;
  slug: string;
  description: string | null;
  published: boolean;
}

export interface Zone {
  id: string;
  room_id: string;
  name: string;
  type: ZoneType;
  capacity: number | null;
  polygon: Polygon;
}

export interface ZoneCount {
  zone_id: string;
  count: number;
  updated_at: string;
}

export interface CameraUnit {
  id: string;
  name: string;
  pair_code: string | null;
  api_key: string;
  room_id: string | null;
  last_seen: string | null;
}

// What the public map and the room page need per room.
export interface PublicRoom extends Room {
  building: Building;
  zones: Zone[];
  // Camera units assigned to this room, heartbeat only.
  units: { id: string; name: string; last_seen: string | null; paused: boolean }[];
}

export function roomTitle(room: { name: string; building: { name: string } }) {
  return `${room.building.name}, ${room.name}`;
}
