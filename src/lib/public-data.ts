import type { SupabaseClient } from "@supabase/supabase-js";
import type { Building, PublicRoom, Room, Zone, ZoneCount } from "@/lib/types";

// Rooms with their building, zones and camera unit heartbeats, plus the
// current counts. Used by the public map, the room page, and the admin
// preview. With the anon client only published rooms come back.

export interface PublicSnapshot {
  rooms: PublicRoom[];
  counts: ZoneCount[];
}

type UnitRow = { id: string; name: string; room_id: string | null; last_seen: string | null; paused: boolean };

export async function loadPublicSnapshot(
  supabase: SupabaseClient,
  filter?: { roomId?: string; buildingSlug?: string; roomSlug?: string }
): Promise<PublicSnapshot> {
  let roomQuery = supabase
    .from("rooms")
    .select("id, building_id, name, slug, description, published, buildings(id, name, slug)")
    .order("name");
  if (filter?.roomId) roomQuery = roomQuery.eq("id", filter.roomId);
  if (filter?.roomSlug) roomQuery = roomQuery.eq("slug", filter.roomSlug);

  const { data: roomRows } = await roomQuery;
  type RoomRow = Room & { buildings: Building | Building[] | null };
  let rooms = ((roomRows ?? []) as unknown as RoomRow[])
    .map((r) => {
      const b = Array.isArray(r.buildings) ? r.buildings[0] : r.buildings;
      return b ? { ...r, building: b } : null;
    })
    .filter((r): r is RoomRow & { building: Building } => r !== null);
  if (filter?.buildingSlug) {
    rooms = rooms.filter((r) => r.building.slug === filter.buildingSlug);
  }
  const roomIds = rooms.map((r) => r.id);
  if (roomIds.length === 0) return { rooms: [], counts: [] };

  const [{ data: zones }, { data: units }] = await Promise.all([
    supabase
      .from("zones")
      .select("id, room_id, name, type, capacity, polygon")
      .in("room_id", roomIds)
      .order("created_at"),
    supabase
      .from("camera_units")
      .select("id, name, room_id, last_seen, paused")
      .in("room_id", roomIds),
  ]);
  const zoneList = (zones ?? []) as Zone[];
  const zoneIds = zoneList.map((z) => z.id);
  const { data: counts } =
    zoneIds.length > 0
      ? await supabase.from("zone_counts").select("zone_id, count, updated_at").in("zone_id", zoneIds)
      : { data: [] as ZoneCount[] };

  const unitList = (units ?? []) as UnitRow[];
  const publicRooms: PublicRoom[] = rooms.map((r) => ({
    id: r.id,
    building_id: r.building_id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    published: r.published,
    building: r.building,
    zones: zoneList.filter((z) => z.room_id === r.id),
    units: unitList
      .filter((u) => u.room_id === r.id)
      .map((u) => ({ id: u.id, name: u.name, last_seen: u.last_seen, paused: u.paused })),
  }));
  return { rooms: publicRooms, counts: (counts ?? []) as ZoneCount[] };
}
