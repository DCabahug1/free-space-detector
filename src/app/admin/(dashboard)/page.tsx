import { Suspense } from "react";
import { connection } from "next/server";
import { bySortThenName, demoDb } from "@/lib/demo-store";
import { frameUrl } from "@/lib/camera-units";
import { AdminHeader } from "@/components/admin-header";
import { Skeleton } from "@/components/ui/skeleton";
import { loadAdminUnits, type AdminRoom } from "./admin-types";
import { AdminTabs } from "./admin-tabs";
import { DeviceCards, PairDialog } from "./device-cards";
import { OverviewCaption } from "./overview-caption";
import { RoomTable } from "./room-table";
import { BuildingDialog } from "./building-dialog";

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

async function Overview({ searchParams }: OverviewProps) {
  // The demo store is live state: read it per request, not in a prerender.
  await connection();
  const { code, tab } = await searchParams;
  const initialCode = code && /^\d{6}$/.test(code) ? code : "";
  const db = demoDb();
  const rooms: AdminRoom[] = [...db.rooms].sort(bySortThenName).flatMap((r) => {
    const building = db.buildings.find((b) => b.id === r.building_id);
    if (!building) return [];
    return [
      {
        ...r,
        building,
        zoneCount: db.zones.filter((z) => z.room_id === r.id).length,
        units: db.units
          .filter((u) => u.room_id === r.id)
          .map((u) => ({ id: u.id, name: u.name, last_seen: u.last_seen, paused: u.paused })),
      },
    ];
  });
  const units = loadAdminUnits();
  const buildings = [...db.buildings].sort((a, b) => a.name.localeCompare(b.name));
  const published = rooms.filter((r) => r.published).length;
  // Where a new building's location map opens: another located building.
  const located = buildings.find((b) => b.lat != null && b.lng != null);
  const fallbackCenter = located && located.lat != null && located.lng != null ? { lat: located.lat, lng: located.lng } : null;

  const roomOptions = rooms.map((r) => ({ id: r.id, name: r.name, building: r.building.name }));
  const initialTab = tab === "camera-units" || initialCode ? "camera-units" : "rooms";

  return (
    <AdminTabs
      initialTab={initialTab}
      rooms={
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold leading-tight">
                {buildings.length === 0 ? "No buildings yet." : "Buildings"}
              </h1>
              <OverviewCaption
                rooms={rooms.length}
                buildings={buildings.length}
                published={published}
                unitsLastSeen={units.map((u) => u.last_seen)}
              />
            </div>
            <BuildingDialog fallbackCenter={fallbackCenter} />
          </div>
          {buildings.length > 0 ? <RoomTable rooms={rooms} buildings={buildings} /> : null}
        </section>
      }
      units={
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold leading-tight">Camera units</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
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
    <>
      <AdminHeader />
      <main className="mx-auto w-full max-w-[1120px] space-y-4 px-4 pt-6 pb-12" aria-busy aria-label="Loading">
        <Skeleton className="h-9 w-[200px]" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </main>
    </>
  );
}
