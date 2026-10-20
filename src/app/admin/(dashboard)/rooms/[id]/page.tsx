import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { frameUrl } from "@/lib/camera-units";
import type { Room, Zone, ZoneCount } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { RoomHeader } from "./room-header";
import { ZoneEditor } from "./zone-editor";

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <RoomContent params={params} />
    </Suspense>
  );
}

async function RoomContent({ params }: RoomPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, kind, published")
    .eq("id", id)
    .maybeSingle();

  if (!room) notFound();

  const { data: zones } = await supabase
    .from("zones")
    .select("id, room_id, name, type, capacity, polygon")
    .eq("room_id", id)
    .order("created_at");

  const zoneList = (zones ?? []) as Zone[];
  const zoneIds = zoneList.map((z) => z.id);

  const { data: counts } =
    zoneIds.length > 0
      ? await supabase
          .from("zone_counts")
          .select("zone_id, count, updated_at")
          .in("zone_id", zoneIds)
      : { data: [] as ZoneCount[] };

  const countMap = Object.fromEntries(
    ((counts ?? []) as ZoneCount[]).map((c) => [c.zone_id, c.count])
  ) as Record<string, number>;

  // The camera unit assigned to this room, if any. Its latest frame lives in
  // the public frames bucket and the editor polls it while live.
  const { data: unit } = await supabase
    .from("camera_units")
    .select("id, name, last_seen")
    .eq("room_id", id)
    .order("last_seen", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const liveFrame = unit
    ? { url: frameUrl(unit.id), unitName: unit.name as string, lastSeen: unit.last_seen as string | null }
    : null;

  return (
    <div className="space-y-6">
      <RoomHeader room={room as Room} zoneCount={zoneList.length} />
      <ZoneEditor room={room as Room} zones={zoneList} counts={countMap} liveFrame={liveFrame} />
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
