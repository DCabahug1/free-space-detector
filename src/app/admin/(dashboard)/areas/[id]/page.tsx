import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { demoDb } from "@/lib/demo-store";
import { frameUrl } from "@/lib/camera-units";
import { loadPublicSnapshot } from "@/lib/public-data";
import { AdminHeader } from "@/components/admin-header";
import { Skeleton } from "@/components/ui/skeleton";
import { loadAdminUnits } from "../../admin-types";
import { SetupPage } from "./setup-page";

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
  // The demo store is live state: read it per request, not in a prerender.
  await connection();
  const { id } = await params;
  const { rooms, counts } = loadPublicSnapshot({ roomId: id });
  const room = rooms[0];
  if (!room) notFound();
  const buildings = [...demoDb().buildings].sort((a, b) => a.name.localeCompare(b.name));
  const units = loadAdminUnits();

  // The camera unit with the newest heartbeat, for the live frame.
  const unit = [...room.units].sort((a, b) =>
    (b.last_seen ?? "").localeCompare(a.last_seen ?? "")
  )[0];
  const liveFrame = unit
    ? { url: frameUrl(unit.id), unitName: unit.name, lastSeen: unit.last_seen }
    : null;

  return <SetupPage room={room} buildings={buildings} initialCounts={counts} liveFrame={liveFrame} units={units} />;
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
