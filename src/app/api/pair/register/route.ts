import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomPairCode } from "@/lib/camera-units";

// A camera unit with no stored api_key calls this once on first boot.
// It gets a row, a 6-digit pair code to show on its monitor, and its api_key.
// The api_key is useless until an admin assigns the unit to a room, because
// /api/ingest only accepts zones of the assigned room.

export async function POST() {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const pairCode = randomPairCode();
    const { data, error } = await supabase
      .from("camera_units")
      .insert({ pair_code: pairCode, name: `Camera unit ${pairCode}` })
      .select("id, pair_code, api_key")
      .single();

    if (!error && data) {
      return NextResponse.json({
        ok: true,
        unit_id: data.id,
        pair_code: data.pair_code,
        api_key: data.api_key,
      });
    }
    // 23505 is a unique violation: the pair code is already in use, try again.
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Could not allocate a pair code" }, { status: 500 });
}
