import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { frameUrl } from "@/lib/camera-units";
import { loadPublicSnapshot } from "@/lib/public-data";
import { Skeleton } from "@/components/ui/skeleton";
import { SetupPage } from "./setup-page";

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomSetup({ params }: RoomPageProps) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <RoomContent params={params} />
    </Suspense>
  );
}

async function RoomContent({ params }: RoomPageProps) {
  // The Supabase session read uses Date.now(), which cacheComponents rejects
  // during prerender. Render these admin pages at request time.
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const { rooms, counts } = await loadPublicSnapshot(supabase, { roomId: id });
  const room = rooms[0];
  if (!room) notFound();

  // The camera unit with the newest heartbeat, for the live frame.
  const unit = [...room.units].sort((a, b) =>
    (b.last_seen ?? "").localeCompare(a.last_seen ?? "")
  )[0];
  const liveFrame = unit
    ? { url: frameUrl(unit.id), unitName: unit.name, lastSeen: unit.last_seen }
    : null;

  return <SetupPage room={room} initialCounts={counts} liveFrame={liveFrame} />;
}

function RoomSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16" />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <Skeleton className="h-48" />
        <Skeleton className="aspect-video w-full" />
      </div>
    </div>
  );
}
