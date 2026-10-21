import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { frameUrl } from "@/lib/camera-units";
import type { Building } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminRoom, AdminUnit } from "./admin-types";
import { AdminTabs } from "./admin-tabs";
import { DeviceCards, PairDialog } from "./device-cards";
import { OverviewCaption } from "./overview-caption";
import { RoomTable } from "./room-table";
import { SetupRoomDialog } from "./setup-room-dialog";

interface OverviewProps {
  // The QR code on a camera unit's monitor links here with ?code=123456.
  // ?tab=camera-units opens the second tab.
  searchParams: Promise<{ code?: string; tab?: string }>;
}

export default function AdminOverview({ searchParams }: OverviewProps) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

type RoomRow = {
  id: string;
  building_id: string;
  name: string;
  slug: string;
  description: string | null;
  published: boolean;
  buildings: Building | Building[] | null;
  zones: { count: number }[];
  camera_units: { id: string; name: string; last_seen: string | null; paused: boolean }[];
};

type UnitRow = {
  id: string;
  name: string;
  pair_code: string | null;
  room_id: string | null;
  last_seen: string | null;
  paused: boolean;
  rooms: { id: string; name: string; buildings: { id: string; name: string } | { id: string; name: string }[] | null } | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function Overview({ searchParams }: OverviewProps) {
  // The Supabase session read uses Date.now(), which cacheComponents rejects
  // during prerender. Render these admin pages at request time.
  await connection();
  const { code, tab } = await searchParams;
  const initialCode = code && /^\d{6}$/.test(code) ? code : "";
  const supabase = await createClient();
  const [{ data: roomRows, error }, { data: unitRows }, { data: buildingRows }] = await Promise.all([
    supabase
      .from("rooms")
      .select(
        "id, building_id, name, slug, description, published, buildings(id, name, slug), zones(count), camera_units(id, name, last_seen, paused)"
      )
      .order("name"),
    supabase
      .from("camera_units")
      .select("id, name, pair_code, room_id, last_seen, paused, rooms(id, name, buildings(id, name))")
      .order("created_at"),
    supabase.from("buildings").select("id, name, slug").order("name"),
  ]);

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const rooms: AdminRoom[] = ((roomRows ?? []) as unknown as RoomRow[])
    .map((r) => {
      const building = one(r.buildings);
      if (!building) return null;
      return {
        id: r.id,
        building_id: r.building_id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        published: r.published,
        building,
        zoneCount: r.zones?.[0]?.count ?? 0,
        units: r.camera_units ?? [],
      };
    })
    .filter((r): r is AdminRoom => r !== null);

  const units: AdminUnit[] = ((unitRows ?? []) as unknown as UnitRow[]).map((u) => {
    const room = u.rooms;
    const building = room ? one(room.buildings) : null;
    return {
      id: u.id,
      name: u.name,
      pair_code: u.pair_code,
      room_id: u.room_id,
      last_seen: u.last_seen,
      paused: u.paused,
      room: room && building ? { id: room.id, name: room.name, building } : null,
    };
  });

  const buildings = (buildingRows ?? []) as Building[];
  const published = rooms.filter((r) => r.published).length;
  const buildingCount = new Set(rooms.map((r) => r.building_id)).size;

  const roomOptions = rooms.map((r) => ({ id: r.id, name: r.name, building: r.building.name }));
  const initialTab = tab === "camera-units" || initialCode ? "camera-units" : "rooms";

  return (
    <AdminTabs
      initialTab={initialTab}
      rooms={
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{rooms.length === 0 ? "No areas yet." : "Areas"}</h1>
              <OverviewCaption
                rooms={rooms.length}
                buildings={buildingCount}
                published={published}
                unitsLastSeen={units.map((u) => u.last_seen)}
              />
            </div>
            <SetupRoomDialog buildings={buildings} />
          </div>
          {rooms.length > 0 ? <RoomTable rooms={rooms} /> : null}
        </section>
      }
      units={
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Camera units</h1>
              <p className="text-[13px] text-muted-foreground">
                {units.length === 0
                  ? "A camera unit shows a 6-digit code on its screen until it is paired."
                  : `${units.length} ${units.length === 1 ? "camera unit" : "camera units"}.`}
              </p>
            </div>
            <PairDialog rooms={roomOptions} initialCode={initialCode} />
          </div>
          <DeviceCards units={units.map((u) => ({ ...u, frameUrl: frameUrl(u.id) }))} rooms={roomOptions} />
        </section>
      }
    />
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </div>
  );
}
