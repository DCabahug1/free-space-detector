import { Suspense } from "react";
import { PublicFooter, SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { createPublicClient } from "@/lib/supabase/public";
import { loadPublicSnapshot } from "@/lib/public-data";
import { LiveMap } from "@/components/public-map/live-map";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1120px] px-4 py-6 md:py-10">
        <Suspense fallback={<MapSkeleton />}>
          <MapLoader />
        </Suspense>
      </main>
      <PublicFooter />
    </>
  );
}

async function MapLoader() {
  const { rooms, counts } = await loadPublicSnapshot(createPublicClient());
  return <LiveMap rooms={rooms.filter((r) => r.published)} initialCounts={counts} />;
}

function MapSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-11 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-80" />
      <div className="grid gap-8 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-40" />
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-14" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
