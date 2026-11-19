"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { demoDb, newId, type StoredUnit } from "@/lib/demo-store";
import { slugify } from "@/lib/slug";

// Demo build: every action below mutates the in-memory store in
// src/lib/demo-store.ts instead of Supabase. Validation is unchanged.

export type ActionResult = { error?: string };

// ---------- auth ----------

// No login in the demo. Sign out just leaves the admin app.
export async function signOut() {
  redirect("/");
}

// ---------- buildings and rooms ----------

const roomSchema = z.object({
  buildingId: z.string().uuid("Pick a building."),
  name: z.string().trim().min(1, "Name the area.").max(80),
  description: z.string().trim().max(140).optional().or(z.literal("")),
});

export type RoomInput = z.infer<typeof roomSchema>;

// A slug unique within the building: "floor-2", then "floor-2-2".
function uniqueRoomSlug(buildingId: string, name: string, exceptId?: string) {
  const base = slugify(name);
  const taken = new Set(
    demoDb()
      .rooms.filter((r) => r.building_id === buildingId && r.id !== exceptId)
      .map((r) => r.slug)
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

// Adds an area to an existing building.
export async function createRoom(input: RoomInput): Promise<ActionResult & { id?: string }> {
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid area." };
  }
  const db = demoDb();
  if (!db.buildings.some((b) => b.id === parsed.data.buildingId)) return { error: "Pick a building." };
  const id = newId();
  db.rooms.push({
    id,
    building_id: parsed.data.buildingId,
    name: parsed.data.name,
    slug: uniqueRoomSlug(parsed.data.buildingId, parsed.data.name),
    description: parsed.data.description || null,
    published: false,
    sort_order: db.rooms.filter((r) => r.building_id === parsed.data.buildingId).length,
  });

  revalidatePath("/admin");
  return { id };
}

// Renames an area, changes its description, or moves it to another building.
export async function updateRoom(roomId: string, input: RoomInput): Promise<ActionResult> {
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid area." };
  }
  const db = demoDb();
  const room = db.rooms.find((r) => r.id === roomId);
  if (!room) return { error: "Area not found." };
  if (!db.buildings.some((b) => b.id === parsed.data.buildingId)) return { error: "Pick a building." };
  Object.assign(room, {
    building_id: parsed.data.buildingId,
    name: parsed.data.name,
    slug: uniqueRoomSlug(parsed.data.buildingId, parsed.data.name, roomId),
    description: parsed.data.description || null,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/areas/${roomId}`);
  revalidatePath("/");
  return {};
}

const buildingSchema = z
  .object({
    name: z.string().trim().min(1, "Name the building.").max(80),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
  })
  .refine((b) => (b.lat == null) === (b.lng == null), { message: "Invalid location." });

export type BuildingInput = z.infer<typeof buildingSchema>;

function buildingSlugTaken(slug: string, exceptId?: string) {
  return demoDb().buildings.some((b) => b.slug === slug && b.id !== exceptId);
}

// A building on its own, with no areas yet. Its location is optional.
export async function createBuilding(input: BuildingInput): Promise<ActionResult & { id?: string }> {
  const parsed = buildingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid building." };
  }
  const slug = slugify(parsed.data.name);
  if (buildingSlugTaken(slug)) return { error: "A building with that name already exists." };

  const id = newId();
  demoDb().buildings.push({ id, name: parsed.data.name, slug, lat: parsed.data.lat, lng: parsed.data.lng });

  revalidatePath("/admin");
  revalidatePath("/");
  return { id };
}

// Renames a building and its slug, and sets or clears its map location.
export async function updateBuilding(buildingId: string, input: BuildingInput): Promise<ActionResult> {
  const parsed = buildingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid building." };
  }
  const slug = slugify(parsed.data.name);
  if (buildingSlugTaken(slug, buildingId)) {
    return { error: "A building with that name already exists." };
  }
  const building = demoDb().buildings.find((b) => b.id === buildingId);
  if (!building) return { error: "Building not found." };
  Object.assign(building, { name: parsed.data.name, slug, lat: parsed.data.lat, lng: parsed.data.lng });

  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

const idList = z.array(z.string().uuid()).min(1).max(200);

// Stores the dragged order of a building's areas: position = index.
export async function reorderRooms(buildingId: string, roomIds: string[]): Promise<ActionResult> {
  const parsed = idList.safeParse(roomIds);
  if (!parsed.success) return { error: "Invalid order." };
  const db = demoDb();
  parsed.data.forEach((id, i) => {
    const room = db.rooms.find((r) => r.id === id && r.building_id === buildingId);
    if (room) room.sort_order = i;
  });
  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

// Stores the dragged order of an area's zones: position = index.
export async function reorderZones(roomId: string, zoneIds: string[]): Promise<ActionResult> {
  const parsed = idList.safeParse(zoneIds);
  if (!parsed.success) return { error: "Invalid order." };
  const db = demoDb();
  parsed.data.forEach((id, i) => {
    const zone = db.zones.find((z) => z.id === id && z.room_id === roomId);
    if (zone) zone.sort_order = i;
  });
  revalidatePath(`/admin/areas/${roomId}`);
  revalidatePath("/");
  return {};
}

// Same cascade as the database: zones and counts go with the area, camera
// units stay registered, unpaired.
function removeRooms(roomIds: Set<string>) {
  const db = demoDb();
  const zoneIds = new Set(db.zones.filter((z) => roomIds.has(z.room_id)).map((z) => z.id));
  db.rooms = db.rooms.filter((r) => !roomIds.has(r.id));
  db.zones = db.zones.filter((z) => !zoneIds.has(z.id));
  for (const id of zoneIds) db.counts.delete(id);
  for (const u of db.units) if (u.room_id && roomIds.has(u.room_id)) u.room_id = null;
}

// Deletes a building with its areas.
export async function deleteBuilding(buildingId: string): Promise<ActionResult> {
  const db = demoDb();
  removeRooms(new Set(db.rooms.filter((r) => r.building_id === buildingId).map((r) => r.id)));
  db.buildings = db.buildings.filter((b) => b.id !== buildingId);

  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function setRoomPublished(
  roomId: string,
  published: boolean
): Promise<ActionResult> {
  const room = demoDb().rooms.find((r) => r.id === roomId);
  if (!room) return { error: "Area not found." };
  room.published = published;

  revalidatePath("/admin");
  revalidatePath(`/admin/areas/${roomId}`);
  revalidatePath("/");
  return {};
}

export async function deleteRoom(roomId: string): Promise<ActionResult> {
  removeRooms(new Set([roomId]));
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

// ---------- zones ----------

const pointSchema = z.tuple([z.number().finite(), z.number().finite()]);

// Every zone is seating with a capacity. "open" and "line" are deprecated
// and no longer saved.
const zoneInputSchema = z.object({
  name: z.string().trim().min(1, "Name the zone.").max(80),
  type: z.literal("seating"),
  capacity: z.number().int().min(1, "Set the seats.").max(500).nullable(),
  polygon: z.array(pointSchema).min(3, "A zone needs at least 3 points."),
});

export type ZoneInput = z.infer<typeof zoneInputSchema>;

function normalizeZone(input: ZoneInput) {
  const parsed = zoneInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid zone." };
  }
  const data = parsed.data;
  if (data.capacity == null) return { error: "Set the seats." };
  // Store integer frame pixels.
  data.polygon = data.polygon.map(([x, y]) => [Math.round(x), Math.round(y)]);
  return { data };
}

export async function createZone(
  roomId: string,
  input: ZoneInput
): Promise<ActionResult & { id?: string }> {
  const { data, error } = normalizeZone(input);
  if (error || !data) return { error };

  const db = demoDb();
  if (!db.rooms.some((r) => r.id === roomId)) return { error: "Area not found." };
  const id = newId();
  const now = new Date().toISOString();
  db.zones.push({
    id,
    room_id: roomId,
    ...data,
    sort_order: db.zones.filter((z) => z.room_id === roomId).length,
    created_at: now,
  });
  db.counts.set(id, { zone_id: id, count: 0, updated_at: now });

  revalidatePath(`/admin/areas/${roomId}`);
  revalidatePath("/");
  return { id };
}

export async function updateZone(
  zoneId: string,
  roomId: string,
  input: ZoneInput
): Promise<ActionResult> {
  const { data, error } = normalizeZone(input);
  if (error || !data) return { error };

  const zone = demoDb().zones.find((z) => z.id === zoneId);
  if (!zone) return { error: "Zone not found." };
  Object.assign(zone, data);

  revalidatePath(`/admin/areas/${roomId}`);
  revalidatePath("/");
  return {};
}

export async function deleteZone(
  zoneId: string,
  roomId: string
): Promise<ActionResult> {
  const db = demoDb();
  db.zones = db.zones.filter((z) => z.id !== zoneId);
  db.counts.delete(zoneId);

  revalidatePath(`/admin/areas/${roomId}`);
  revalidatePath("/");
  return {};
}

// ---------- camera units ----------

const pairSchema = z.object({
  pair_code: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "The pair code is 6 digits.")),
  room_id: z.string().uuid("Pick an area."),
});

// A unit that is already paired to a different area. The client confirms
// before the move goes through.
export type UnitTransfer = { id: string; name: string; from: string };

function homeLabel(unit: StoredUnit) {
  const db = demoDb();
  const room = db.rooms.find((r) => r.id === unit.room_id);
  const building = room && db.buildings.find((b) => b.id === room.building_id);
  return room ? `${building?.name ?? ""}, ${room.name}` : "";
}

// Moves a unit to a room. Without allowTransfer, a unit paired to a different
// room is left alone and the caller gets a transfer to confirm.
function moveUnit(
  unit: StoredUnit,
  roomId: string,
  allowTransfer: boolean
): ActionResult & { unit?: { id: string; name: string }; transfer?: UnitTransfer } {
  if (!demoDb().rooms.some((r) => r.id === roomId)) return { error: "Pick an area." };
  if (unit.room_id && unit.room_id !== roomId && !allowTransfer) {
    return { transfer: { id: unit.id, name: unit.name, from: homeLabel(unit) } };
  }
  const before = unit.room_id;
  unit.room_id = roomId;
  // A real unit stops showing its code once claimed.
  unit.pair_code = null;
  unit.last_seen = new Date().toISOString();

  revalidatePath("/admin");
  revalidatePath(`/admin/areas/${roomId}`);
  if (before && before !== roomId) revalidatePath(`/admin/areas/${before}`);
  revalidatePath("/");
  return { unit: { id: unit.id, name: unit.name } };
}

// Claims a camera unit by its 6-digit pair code and assigns it to a room.
// The code of a unit paired to another room comes back as a transfer until
// confirmed.
export async function pairCameraUnit(
  pairCode: string,
  roomId: string,
  allowTransfer = false
): Promise<ActionResult & { unit?: { id: string; name: string }; transfer?: UnitTransfer }> {
  const parsed = pairSchema.safeParse({ pair_code: pairCode, room_id: roomId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const unit = demoDb().units.find((u) => u.pair_code === parsed.data.pair_code);
  if (!unit) return { error: "No camera unit is showing that code." };
  return moveUnit(unit, parsed.data.room_id, allowTransfer);
}

// Assigns a unit to a room by id, or unpairs it with null. Same transfer
// rule as pairing: a unit paired elsewhere needs allowTransfer.
export async function assignCameraUnit(
  unitId: string,
  roomId: string | null,
  allowTransfer = false
): Promise<ActionResult & { unit?: { id: string; name: string }; transfer?: UnitTransfer }> {
  const unit = demoDb().units.find((u) => u.id === unitId);
  if (!unit) return { error: "Camera unit not found." };
  if (roomId === null) {
    const before = unit.room_id;
    unit.room_id = null;
    revalidatePath("/admin");
    if (before) revalidatePath(`/admin/areas/${before}`);
    revalidatePath("/");
    return {};
  }
  return moveUnit(unit, roomId, allowTransfer);
}

export async function renameCameraUnit(
  unitId: string,
  name: string
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name the camera unit." };
  const unit = demoDb().units.find((u) => u.id === unitId);
  if (!unit) return { error: "Camera unit not found." };
  unit.name = trimmed.slice(0, 80);
  revalidatePath("/admin");
  return {};
}

// Asks a camera unit to pull the latest code. The store clears the request
// after a short delay, as a real unit would on its next poll.
export async function requestCameraUnitUpdate(unitId: string): Promise<ActionResult> {
  const unit = demoDb().units.find((u) => u.id === unitId);
  if (!unit) return { error: "Camera unit not found." };
  unit.update_requested_at = new Date().toISOString();
  revalidatePath("/admin");
  return {};
}

// Removes a camera unit's record.
export async function deleteCameraUnit(unitId: string): Promise<ActionResult> {
  const db = demoDb();
  db.units = db.units.filter((u) => u.id !== unitId);
  revalidatePath("/admin");
  return {};
}
