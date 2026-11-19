import { connection } from "next/server";
import { demoDb } from "@/lib/demo-store";

// Demo stand-in for Realtime: the public pages poll this for every zone
// count and camera unit heartbeat.
export async function GET() {
  await connection();
  const db = demoDb();
  return Response.json({
    counts: [...db.counts.values()],
    units: db.units.map((u) => ({ id: u.id, last_seen: u.last_seen, paused: u.paused })),
  });
}
