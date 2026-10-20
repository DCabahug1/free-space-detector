import type { SupabaseClient } from "@supabase/supabase-js";

// Shared helpers for the camera unit API routes (/api/ingest, /api/frame,
// /api/pair/*). All of them use the service role client.

export const FRAMES_BUCKET = "frames";

export function framePath(unitId: string) {
  return `${unitId}.jpg`;
}

// Public URL of a camera unit's latest frame. The bucket is public, so this
// works from any <img> without a session.
export function frameUrl(unitId: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${FRAMES_BUCKET}/${framePath(unitId)}`;
}

export async function findUnitByApiKey(supabase: SupabaseClient, apiKey: string) {
  const { data, error } = await supabase
    .from("camera_units")
    .select("id, name, room_id")
    .eq("api_key", apiKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; name: string; room_id: string | null } | null;
}

export async function touchLastSeen(supabase: SupabaseClient, unitId: string) {
  await supabase
    .from("camera_units")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", unitId);
}

export function randomPairCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
