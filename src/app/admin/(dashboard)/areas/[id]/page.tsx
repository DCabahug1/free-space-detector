import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { frameUrl } from "@/lib/camera-units";
import { loadPublicSnapshot } from "@/lib/public-data";
import { AdminHeader } from "@/components/admin-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminUnit } from "../../admin-types";
import { SetupPage } from "./setup-page";

type UnitRow = {
  id: string;
  name: string;
  pair_code: string | null;
  room_id: string | null;
  last_seen: string | null;
  paused: boolean;
  version: string | null;
  update_requested_at: string | null;
  rooms: { id: string; name: string; buildings: { id: string; name: string } | { id: string; name: string }[] | null } | null;
};

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomSetup({ params }: RoomPageProps) {
  return (
    <>
      <AdminHeader wide />
      <main className="mx-auto w-full max-w-[1360px] px-6 pt-6 pb-12">
        <Suspense fallback={<RoomSkeleton />}>
          <RoomContent params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function RoomContent({ params }: RoomPageProps) {
  // The Supabase session read uses Date.now(), which cacheComponents rejects
  // during prerender. Render these admin pages at request time.
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const [{ rooms, counts }, { data: unitRows }] = await Promise.all([
    loadPublicSnapshot(supabase, { roomId: id }),
    supabase
      .from("camera_units")
      .select("id, name, pair_code, room_id, last_seen, paused, version, update_requested_at, rooms(id, name, buildings(id, name))")
      .order("created_at"),
  ]);
  const room = rooms[0];
  if (!room) notFound();

  const units: AdminUnit[] = ((unitRows ?? []) as unknown as UnitRow[]).map((u) => {
    const b = u.rooms?.buildings;
    const building = Array.isArray(b) ? (b[0] ?? null) : b;
    return {
      id: u.id,
      name: u.name,
      pair_code: u.pair_code,
      room_id: u.room_id,
      last_seen: u.last_seen,
      paused: u.paused,
      version: u.version,
      update_requested_at: u.update_requested_at,
      room: u.rooms && building ? { id: u.rooms.id, name: u.rooms.name, building } : null,
    };
  });

  // The camera unit with the newest heartbeat, for the live frame.
  const unit = [...room.units].sort((a, b) =>
    (b.last_seen ?? "").localeCompare(a.last_seen ?? "")
  )[0];
  const liveFrame = unit
    ? { url: frameUrl(unit.id), unitName: unit.name, lastSeen: unit.last_seen }
    : null;

  return <SetupPage room={room} initialCounts={counts} liveFrame={liveFrame} units={units} />;
}

function RoomSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading">
      <Skeleton className="h-16" />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <Skeleton className="h-48" />
        <Skeleton className="aspect-video w-full" />
      </div>
    </div>
  );
}
