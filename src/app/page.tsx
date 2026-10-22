import { Suspense } from "react";
import { Band, Wrap } from "@/components/band";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { createPublicClient } from "@/lib/supabase/public";
import { loadPublicSnapshot } from "@/lib/public-data";
import { LiveMap } from "@/components/public-map/live-map";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<MapSkeleton />}>
        <MapLoader />
      </Suspense>
    </>
  );
}

async function MapLoader() {
  const { rooms, counts } = await loadPublicSnapshot(createPublicClient());
  return <LiveMap rooms={rooms.filter((r) => r.published)} initialCounts={counts} />;
}

function MapSkeleton() {
  return (
    <>
      <Band className="pt-5 pb-9">
        <Wrap className="flex flex-col gap-2.5">
          <h1 className="text-[44px] font-semibold leading-none tracking-[-0.02em]">Find a free spot</h1>
          <Skeleton className="h-[13px] w-56 bg-band-2" />
        </Wrap>
      </Band>
      <Wrap className="flex flex-col gap-6 pt-6 pb-12" aria-busy aria-label="Loading">
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
          <Skeleton className="mt-9 h-[240px] w-full rounded-lg md:h-[320px]" />
        ) : null}
        <Skeleton className="h-9 w-full max-w-xs" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-8">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      </Wrap>
    </>
  );
}
