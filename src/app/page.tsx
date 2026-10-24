import { Suspense } from "react";
import { Wrap } from "@/components/band";
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
    <Wrap
      className="grid max-w-[1280px] gap-x-12 gap-y-10 pt-10 pb-16 md:pt-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr]"
      aria-busy
      aria-label="Loading"
    >
      <div className="flex flex-col gap-5">
        <h1 className="text-[40px] font-semibold leading-[0.95] tracking-[-0.03em] md:text-[56px]">Find a free spot</h1>
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2">
        <Skeleton className="h-10 w-full" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[72px]" />
        ))}
      </div>
      <Skeleton className="hidden h-[420px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block" />
    </Wrap>
  );
}
