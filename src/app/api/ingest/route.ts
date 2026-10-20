import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Camera units POST here every 30 s:
//   { api_key, counts: [{ zone_id, count }] }
// The api_key identifies the camera unit. Only zones belonging to that
// camera unit's room are accepted, so a leaked key cannot write other rooms.

const bodySchema = z.object({
  api_key: z.string().min(1),
  counts: z
    .array(
      z.object({
        zone_id: z.string().uuid(),
        count: z.number().int().min(0).max(1000),
      })
    )
    .max(200),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { api_key, counts } = parsed.data;

  const supabase = createAdminClient();

  const { data: unit, error: unitError } = await supabase
    .from("camera_units")
    .select("id, room_id")
    .eq("api_key", api_key)
    .maybeSingle();

  if (unitError) {
    return NextResponse.json({ error: unitError.message }, { status: 500 });
  }
  if (!unit) {
    return NextResponse.json({ error: "Unknown api_key" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Always record the heartbeat, even if the unit has no room yet.
  await supabase
    .from("camera_units")
    .update({ last_seen: now })
    .eq("id", unit.id);

  if (!unit.room_id) {
    return NextResponse.json(
      { ok: true, accepted: 0, reason: "camera unit not assigned to a room" },
      { status: 200 }
    );
  }

  // Only accept zone_ids that belong to this camera unit's room.
  const { data: zones, error: zonesError } = await supabase
    .from("zones")
    .select("id")
    .eq("room_id", unit.room_id);

  if (zonesError) {
    return NextResponse.json({ error: zonesError.message }, { status: 500 });
  }

  const allowed = new Set((zones ?? []).map((z) => z.id));
  const rows = counts
    .filter((c) => allowed.has(c.zone_id))
    .map((c) => ({ zone_id: c.zone_id, count: c.count, updated_at: now }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("zone_counts")
      .upsert(rows, { onConflict: "zone_id" });
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    accepted: rows.length,
    ignored: counts.length - rows.length,
  });
}
