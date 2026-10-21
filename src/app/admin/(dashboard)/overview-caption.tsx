"use client";

import { useClock } from "@/hooks/use-clock";
import { isOffline } from "@/lib/occupancy";

interface OverviewCaptionProps {
  rooms: number;
  buildings: number;
  published: number;
  unitsLastSeen: (string | null)[];
}

// "3 rooms in 2 buildings, 2 published. 1 camera unit offline."
export function OverviewCaption({ rooms, buildings, published, unitsLastSeen }: OverviewCaptionProps) {
  const now = useClock();
  if (rooms === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Name a building and a room, pair a camera unit, draw zones, publish.
      </p>
    );
  }
  const offline = unitsLastSeen.filter((s) => isOffline(s, now)).length;
  return (
    <p className="text-[13px] text-muted-foreground">
      {rooms} {rooms === 1 ? "room" : "rooms"} in {buildings} {buildings === 1 ? "building" : "buildings"},{" "}
      {published} published.
      {offline > 0 ? ` ${offline} ${offline === 1 ? "camera unit" : "camera units"} offline.` : ""}
    </p>
  );
}
