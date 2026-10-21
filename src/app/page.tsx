import { Suspense } from "react";
import { SiteNav } from "@/components/site-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { createPublicClient } from "@/lib/supabase/public";
import type { Room, Zone, ZoneCount } from "@/lib/types";
import { LiveMap, type RoomWithZones } from "@/components/public-map/live-map";

export default function Home() {
  return (
    <>
      <SiteNav current="map" />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
        <div className="mb-6 space-y-1">
          <h1 className="text-3xl font-semibold md:text-4xl">Find a free spot</h1>
          <p className="text-muted-foreground">
            Live occupancy from camera units around campus. Counts only, never
            video.
          </p>
        </div>
        <Suspense fallback={<MapSkeleton />}>
          <MapLoader />
        </Suspense>
      </main>
    </>
  );
}

async function MapLoader() {
  const supabase = createPublicClient();

  const [{ data: rooms }, { data: zones }, { data: counts }] =
    await Promise.all([
      supabase
        .from("rooms")
        .select("id, name, kind, published")
        .eq("published", true)
        .order("name"),
      supabase
        .from("zones")
        .select("id, room_id, name, type, capacity, polygon")
        .order("created_at"),
      supabase.from("zone_counts").select("zone_id, count, updated_at"),
    ]);

  const roomsWithZones: RoomWithZones[] = ((rooms ?? []) as Room[]).map(
    (room) => ({
      ...room,
      zones: ((zones ?? []) as Zone[]).filter((z) => z.room_id === room.id),
    })
  );

  return (
    <LiveMap
      rooms={roomsWithZones}
      initialCounts={(counts ?? []) as ZoneCount[]}
    />
  );
}

function MapSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-4 rounded-xl border p-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-28" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
