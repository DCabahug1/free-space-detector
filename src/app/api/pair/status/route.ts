import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findUnitByApiKey } from "@/lib/camera-units";

// Camera units poll this with their api_key until an admin assigns a room.
// Also used after pairing to learn the current room (admins can reassign).

// sharing is optional: the camera unit sends false while Pause sharing is on.
// version is the running code's short git hash, kept for the admin app.
const bodySchema = z.object({
  api_key: z.string().min(1),
  sharing: z.boolean().optional(),
  version: z.string().max(64).optional(),
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
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const unit = await findUnitByApiKey(supabase, parsed.data.api_key);
  if (!unit) {
    return NextResponse.json({ error: "Unknown api_key" }, { status: 401 });
  }

  // Skip the write when the stored hash already matches. A null stored
  // value never passes neq, so it is matched on its own.
  const version = parsed.data.version?.replace(/[^0-9a-f]/gi, "");
  if (version) {
    await supabase
      .from("camera_units")
      .update({ version })
      .eq("id", unit.id)
      .or(`version.is.null,version.neq.${version}`);
  }

  // An admin asked for a code update. Handing it over clears the request,
  // so the unit runs the updater once. The admin asks again if it failed.
  const { data: requested } = await supabase
    .from("camera_units")
    .update({ update_requested_at: null })
    .eq("id", unit.id)
    .not("update_requested_at", "is", null)
    .select("id");
  const update_requested = (requested?.length ?? 0) > 0;

  // Not a heartbeat on purpose: only count posts and frames bump last_seen.
  // The sharing flag lands in camera_units.paused so the map can say Paused.
  if (parsed.data.sharing !== undefined) {
    await supabase
      .from("camera_units")
      .update({ paused: !parsed.data.sharing })
      .eq("id", unit.id)
      .neq("paused", !parsed.data.sharing);
  }

  if (!unit.room_id) {
    return NextResponse.json({ ok: true, paired: false, unit_id: unit.id, name: unit.name, update_requested });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, buildings(name)")
    .eq("id", unit.room_id)
    .maybeSingle();
  const building = Array.isArray(room?.buildings) ? room?.buildings[0] : room?.buildings;

  return NextResponse.json({
    ok: true,
    paired: true,
    unit_id: unit.id,
    name: unit.name,
    room_id: unit.room_id,
    room_name: room?.name ?? null,
    building_name: (building as { name: string } | null | undefined)?.name ?? null,
    update_requested,
  });
}
