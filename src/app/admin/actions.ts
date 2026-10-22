"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";

export type ActionResult = { error?: string };

// ---------- auth ----------

export type SignInState = { error?: string };

export async function signIn(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  if (!email || !password) {
    return { error: "Wrong email or password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Wrong email or password." };
  }

  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------- buildings and rooms ----------

const roomSchema = z.object({
  buildingId: z.string().uuid("Pick a building."),
  name: z.string().trim().min(1, "Name the area.").max(80),
  description: z.string().trim().max(140).optional().or(z.literal("")),
});

export type RoomInput = z.infer<typeof roomSchema>;

type Db = Awaited<ReturnType<typeof createClient>>;

// A slug unique within the building: "floor-2", then "floor-2-2".
async function uniqueRoomSlug(supabase: Db, buildingId: string, name: string, exceptId?: string) {
  const base = slugify(name);
  const { data } = await supabase
    .from("rooms")
    .select("id, slug")
    .eq("building_id", buildingId)
    .like("slug", `${base}%`);
  const taken = new Set((data ?? []).filter((r) => r.id !== exceptId).map((r) => r.slug as string));
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
  const supabase = await createClient();
  const slug = await uniqueRoomSlug(supabase, parsed.data.buildingId, parsed.data.name);
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      building_id: parsed.data.buildingId,
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { id: data.id as string };
}

// Renames an area, changes its description, or moves it to another building.
export async function updateRoom(roomId: string, input: RoomInput): Promise<ActionResult> {
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid area." };
  }
  const supabase = await createClient();
  const slug = await uniqueRoomSlug(supabase, parsed.data.buildingId, parsed.data.name, roomId);
  const { error } = await supabase
    .from("rooms")
    .update({
      building_id: parsed.data.buildingId,
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
    })
    .eq("id", roomId);
  if (error) return { error: error.message };

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

async function buildingSlugTaken(supabase: Db, slug: string, exceptId?: string) {
  let q = supabase.from("buildings").select("id").eq("slug", slug);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.maybeSingle();
  return data != null;
}

// A building on its own, with no areas yet. Its location is optional.
export async function createBuilding(input: BuildingInput): Promise<ActionResult & { id?: string }> {
  const parsed = buildingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid building." };
  }
  const supabase = await createClient();
  const slug = slugify(parsed.data.name);
  if (await buildingSlugTaken(supabase, slug)) return { error: "A building with that name already exists." };

  const { data, error } = await supabase
    .from("buildings")
    .insert({ name: parsed.data.name, slug, lat: parsed.data.lat, lng: parsed.data.lng })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { id: data.id as string };
}

// Renames a building and its slug, and sets or clears its map location.
// The area URLs under it change with the name.
export async function updateBuilding(buildingId: string, input: BuildingInput): Promise<ActionResult> {
  const parsed = buildingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid building." };
  }
  const supabase = await createClient();
  const slug = slugify(parsed.data.name);
  if (await buildingSlugTaken(supabase, slug, buildingId)) {
    return { error: "A building with that name already exists." };
  }

  const { error } = await supabase
    .from("buildings")
    .update({ name: parsed.data.name, slug, lat: parsed.data.lat, lng: parsed.data.lng })
    .eq("id", buildingId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

// Deletes a building with its areas. Zones and counts cascade with the
// areas; camera units paired there stay registered, unpaired.
export async function deleteBuilding(buildingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error: roomsError } = await supabase.from("rooms").delete().eq("building_id", buildingId);
  if (roomsError) return { error: roomsError.message };
  const { error } = await supabase.from("buildings").delete().eq("id", buildingId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return {};
}

export async function setRoomPublished(
  roomId: string,
  published: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ published })
    .eq("id", roomId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/areas/${roomId}`);
  revalidatePath("/");
  return {};
}

export async function deleteRoom(roomId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

// ---------- zones ----------

const pointSchema = z.tuple([z.number().finite(), z.number().finite()]);

// "line" is deprecated: existing line zones can still be edited, new ones
// cannot be created (see createZone).
const zoneInputSchema = z.object({
  name: z.string().trim().min(1, "Name the zone.").max(80),
  type: z.enum(["seating", "line", "open"]),
  capacity: z.number().int().min(1).max(500).nullable(),
  polygon: z.array(pointSchema).min(3, "A zone needs at least 3 points."),
});

export type ZoneInput = z.infer<typeof zoneInputSchema>;

function normalizeZone(input: ZoneInput) {
  const parsed = zoneInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid zone." };
  }
  const data = parsed.data;
  // Only seating zones carry a capacity.
  if (data.type !== "seating") data.capacity = null;
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
  if (data.type === "line") {
    return { error: "Line zones are not offered. Use an open area." };
  }

  const supabase = await createClient();
  const { data: row, error: dbError } = await supabase
    .from("zones")
    .insert({ room_id: roomId, ...data })
    .select("id")
    .single();
  if (dbError) return { error: dbError.message };

  revalidatePath(`/admin/areas/${roomId}`);
  revalidatePath("/");
  return { id: row.id as string };
}

export async function updateZone(
  zoneId: string,
  roomId: string,
  input: ZoneInput
): Promise<ActionResult> {
  const { data, error } = normalizeZone(input);
  if (error || !data) return { error };

  const supabase = await createClient();
  const { error: dbError } = await supabase
    .from("zones")
    .update(data)
    .eq("id", zoneId);
  if (dbError) return { error: dbError.message };

  revalidatePath(`/admin/areas/${roomId}`);
  revalidatePath("/");
  return {};
}

export async function deleteZone(
  zoneId: string,
  roomId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("zones").delete().eq("id", zoneId);
  if (error) return { error: error.message };

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

type UnitHome = {
  id: string;
  name: string;
  room_id: string | null;
  rooms: { name: string; buildings: { name: string } | { name: string }[] | null } | null;
};

function homeLabel(unit: UnitHome) {
  const b = unit.rooms?.buildings;
  const building = Array.isArray(b) ? b[0] : b;
  return unit.rooms ? `${building?.name ?? ""}, ${unit.rooms.name}` : "";
}

// Moves a unit to a room. Without allowTransfer, a unit paired to a different
// room is left alone and the caller gets a transfer to confirm.
async function moveUnit(
  supabase: Db,
  unit: UnitHome,
  roomId: string,
  allowTransfer: boolean
): Promise<ActionResult & { unit?: { id: string; name: string }; transfer?: UnitTransfer }> {
  if (unit.room_id && unit.room_id !== roomId && !allowTransfer) {
    return { transfer: { id: unit.id, name: unit.name, from: homeLabel(unit) } };
  }
  // The unit is alive (it is showing its code or polling), so stamp the
  // heartbeat now. Its own posts take over within the offline window.
  const { error } = await supabase
    .from("camera_units")
    .update({ room_id: roomId, last_seen: new Date().toISOString() })
    .eq("id", unit.id);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/areas/${roomId}`);
  if (unit.room_id && unit.room_id !== roomId) revalidatePath(`/admin/areas/${unit.room_id}`);
  revalidatePath("/");
  return { unit: { id: unit.id, name: unit.name } };
}

const UNIT_HOME = "id, name, room_id, rooms(name, buildings(name))";

// Claims a camera unit by its 6-digit pair code and assigns it to a room.
// The camera unit polls /api/pair/status until this lands. The code of a
// unit paired to another room comes back as a transfer until confirmed.
export async function pairCameraUnit(
  pairCode: string,
  roomId: string,
  allowTransfer = false
): Promise<ActionResult & { unit?: { id: string; name: string }; transfer?: UnitTransfer }> {
  const parsed = pairSchema.safeParse({ pair_code: pairCode, room_id: roomId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("camera_units")
    .select(UNIT_HOME)
    .eq("pair_code", parsed.data.pair_code)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No camera unit is showing that code." };
  return moveUnit(supabase, data as unknown as UnitHome, parsed.data.room_id, allowTransfer);
}

// Assigns a unit to a room by id, or unpairs it with null. Same transfer
// rule as pairing: a unit paired elsewhere needs allowTransfer.
export async function assignCameraUnit(
  unitId: string,
  roomId: string | null,
  allowTransfer = false
): Promise<ActionResult & { unit?: { id: string; name: string }; transfer?: UnitTransfer }> {
  const supabase = await createClient();
  if (roomId === null) {
    const { data: before } = await supabase
      .from("camera_units")
      .select("room_id")
      .eq("id", unitId)
      .maybeSingle();
    const { error } = await supabase.from("camera_units").update({ room_id: null }).eq("id", unitId);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    if (before?.room_id) revalidatePath(`/admin/areas/${before.room_id}`);
    revalidatePath("/");
    return {};
  }
  const { data, error } = await supabase
    .from("camera_units")
    .select(UNIT_HOME)
    .eq("id", unitId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Camera unit not found." };
  return moveUnit(supabase, data as unknown as UnitHome, roomId, allowTransfer);
}

export async function renameCameraUnit(
  unitId: string,
  name: string
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name the camera unit." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("camera_units")
    .update({ name: trimmed })
    .eq("id", unitId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return {};
}

// Asks a camera unit to pull the latest code. It sees the request on its
// next status poll (every 20 s), pulls, and restarts itself if anything
// came in.
export async function requestCameraUnitUpdate(unitId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("camera_units")
    .update({ update_requested_at: new Date().toISOString() })
    .eq("id", unitId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return {};
}

// Removes a camera unit's record. The physical unit re-registers itself with
// a fresh pair code the next time its script starts.
export async function deleteCameraUnit(unitId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("camera_units").delete().eq("id", unitId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return {};
}
