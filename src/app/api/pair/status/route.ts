import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findUnitByApiKey } from "@/lib/camera-units";

// Camera units poll this with their api_key until an admin assigns a room.
// Also used after pairing to learn the current room (admins can reassign).

// sharing is optional: the camera unit sends false while Pause sharing is on.
const bodySchema = z.object({ api_key: z.string().min(1), sharing: z.boolean().optional() });

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
    return NextResponse.json({ ok: true, paired: false, unit_id: unit.id, name: unit.name });
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
  });
}
