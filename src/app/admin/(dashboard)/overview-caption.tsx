"use client";

import { useClock } from "@/hooks/use-clock";
import { isOffline } from "@/lib/occupancy";

interface OverviewCaptionProps {
  rooms: number;
  buildings: number;
  published: number;
  unitsLastSeen: (string | null)[];
}

// "3 areas in 2 buildings, 2 published. 1 camera unit offline."
export function OverviewCaption({ rooms, buildings, published, unitsLastSeen }: OverviewCaptionProps) {
  const now = useClock();
  if (buildings === 0) {
    return (
      <p className="mt-1 text-[13px] text-muted-foreground">
        Add a building, then an area in it. Pair a camera unit, draw zones, publish.
      </p>
    );
  }
  if (rooms === 0) {
    return (
      <p className="mt-1 text-[13px] text-muted-foreground">
        {buildings} {buildings === 1 ? "building" : "buildings"}, no areas yet.
      </p>
    );
  }
  const offline = unitsLastSeen.filter((s) => isOffline(s, now)).length;
  return (
    <p className="mt-1 text-[13px] text-muted-foreground">
      {rooms} {rooms === 1 ? "area" : "areas"} in {buildings} {buildings === 1 ? "building" : "buildings"},{" "}
      {published} published.
      {offline > 0 ? ` ${offline} ${offline === 1 ? "camera unit" : "camera units"} offline.` : ""}
    </p>
  );
}
