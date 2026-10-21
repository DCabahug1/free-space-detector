import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { createPublicClient } from "@/lib/supabase/public";
import { loadPublicSnapshot } from "@/lib/public-data";
import { RoomView } from "@/components/public-map/room-view";

interface RoomPageProps {
  params: Promise<{ building: string; area: string }>;
}

export default function PublicRoomPage({ params }: RoomPageProps) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1120px] px-4 py-6 md:py-10">
        <Suspense fallback={<RoomSkeleton />}>
          <RoomLoader params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function RoomLoader({ params }: RoomPageProps) {
  const { building, area: roomSlug } = await params;
  const { rooms, counts } = await loadPublicSnapshot(createPublicClient(), {
    buildingSlug: building,
    roomSlug,
  });
  const room = rooms.find((r) => r.published);
  if (!room) notFound();
  return <RoomView room={room} initialCounts={counts} />;
}

function RoomSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-11 w-56" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}
