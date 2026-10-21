import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Band, Wrap } from "@/components/band";
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
      <Suspense fallback={<RoomSkeleton />}>
        <RoomLoader params={params} />
      </Suspense>
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
    <>
      <Band className="pt-5 pb-9" aria-busy aria-label="Loading">
        <Wrap className="flex flex-col gap-3">
          <Skeleton className="h-[13px] w-[30%] bg-band-2" />
          <Skeleton className="h-8 w-[60%] bg-band-2" />
          <Skeleton className="h-[13px] w-[45%] bg-band-2" />
        </Wrap>
      </Band>
      <Wrap className="flex flex-col gap-5 pt-6 pb-12">
        <Skeleton className="h-11 w-1/2" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[136px]" />
          ))}
        </div>
      </Wrap>
    </>
  );
}
