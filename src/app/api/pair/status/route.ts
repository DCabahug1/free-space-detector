import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findUnitByApiKey, touchLastSeen } from "@/lib/camera-units";

// Camera units poll this with their api_key until an admin assigns a room.
// Also used after pairing to learn the current room (admins can reassign).

const bodySchema = z.object({ api_key: z.string().min(1) });

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

  await touchLastSeen(supabase, unit.id);

  if (!unit.room_id) {
    return NextResponse.json({ ok: true, paired: false, unit_id: unit.id, name: unit.name });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("id", unit.room_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    paired: true,
    unit_id: unit.id,
    name: unit.name,
    room_id: unit.room_id,
    room_name: room?.name ?? null,
  });
}
