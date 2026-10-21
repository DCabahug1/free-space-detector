"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------- rooms ----------

const roomSchema = z.object({
  name: z.string().trim().min(1, "Give the room a name.").max(80),
  kind: z.enum(["seating", "line"]),
});

export async function createRoom(formData: FormData): Promise<ActionResult> {
  const parsed = roomSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid room." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/admin");
  redirect(`/admin/rooms/${data.id}`);
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
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath("/");
  return {};
}

export async function renameRoom(
  roomId: string,
  name: string
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Give the room a name." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ name: trimmed })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/admin/rooms/${roomId}`);
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
  name: z.string().trim().min(1, "Give the zone a name.").max(80),
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
    return { error: "Line zones are no longer supported. Use an open area instead." };
  }

  const supabase = await createClient();
  const { data: row, error: dbError } = await supabase
    .from("zones")
    .insert({ room_id: roomId, ...data })
    .select("id")
    .single();
  if (dbError) return { error: dbError.message };

  revalidatePath(`/admin/rooms/${roomId}`);
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

  revalidatePath(`/admin/rooms/${roomId}`);
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

  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath("/");
  return {};
}

// ---------- camera units ----------

const pairSchema = z.object({
  pair_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "The pair code is 6 digits."),
  room_id: z.string().uuid("Pick a room."),
});

// Claims a camera unit by its 6-digit pair code and assigns it to a room.
// The camera unit itself polls for this assignment (build step 5).
export async function pairCameraUnit(
  formData: FormData
): Promise<ActionResult> {
  const parsed = pairSchema.safeParse({
    pair_code: formData.get("pair_code"),
    room_id: formData.get("room_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("camera_units")
    .update({ room_id: parsed.data.room_id })
    .eq("pair_code", parsed.data.pair_code)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "No camera unit is showing that code." };
  }

  revalidatePath("/admin/camera-units");
  return {};
}

export async function assignCameraUnit(
  unitId: string,
  roomId: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("camera_units")
    .update({ room_id: roomId })
    .eq("id", unitId);
  if (error) return { error: error.message };
  revalidatePath("/admin/camera-units");
  return {};
}

export async function renameCameraUnit(
  unitId: string,
  name: string
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Give the camera unit a name." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("camera_units")
    .update({ name: trimmed })
    .eq("id", unitId);
  if (error) return { error: error.message };
  revalidatePath("/admin/camera-units");
  return {};
}
