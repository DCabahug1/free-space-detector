import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FRAMES_BUCKET,
  findUnitByApiKey,
  framePath,
  frameUrl,
  touchLastSeen,
} from "@/lib/camera-units";

// Camera units POST a JPEG here every few seconds so the admin zone editor
// can show a live frame to draw over. Body is the raw image, the api_key
// goes in a header. Only the latest frame is kept, one object per unit.

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Missing x-api-key header" }, { status: 401 });
  }
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/jpeg")) {
    return NextResponse.json({ error: "Body must be image/jpeg" }, { status: 415 });
  }

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `Frame must be between 1 byte and ${MAX_BYTES} bytes` },
      { status: 413 }
    );
  }

  const supabase = createAdminClient();
  const unit = await findUnitByApiKey(supabase, apiKey);
  if (!unit) {
    return NextResponse.json({ error: "Unknown api_key" }, { status: 401 });
  }

  const { error } = await supabase.storage
    .from(FRAMES_BUCKET)
    .upload(framePath(unit.id), bytes, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "0",
    });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await touchLastSeen(supabase, unit.id);
  return NextResponse.json({ ok: true, url: frameUrl(unit.id) });
}
