export type RoomKind = "seating" | "line";
export type ZoneType = "seating" | "line" | "open";

// Polygon vertices in frame pixels, [x, y].
export type Polygon = [number, number][];

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
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
