"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicRoom } from "@/lib/types";
import { freeSeats, roomSummary } from "@/lib/occupancy";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PinButton } from "./pin-button";
import { ZoneTile, sortPinnedFirst } from "./zone-tile";
import { Highlight } from "@/components/highlight";

interface RoomRowProps {
  room: PublicRoom;
  counts: Record<string, number | undefined>;
  // "4 min" while the camera unit is offline, otherwise null.
  offlineFor: string | null;
  // The clock has not started: placeholders stand in for the count and caption.
  loading?: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  isZonePinned: (zoneId: string) => boolean;
  onToggleZonePin: (zoneId: string) => void;
  // Search text to highlight in the name.
  query?: string;
  className?: string;
}

// One directory row: name and summary caption, then the pin, free count,
// and a chevron that opens the area's spots as tiles beneath the row.
// Closed by default. Pinned spots come first in the tiles. The name opens
// the row too. Hairlines come from the parent (divide-y).
export function RoomRow({
  room,
  counts,
  offlineFor,
  loading = false,
  pinned,
  onTogglePin,
  isZonePinned,
  onToggleZonePin,
  query = "",
  className,
}: RoomRowProps) {
  const [open, setOpen] = useState(false);
  const offline = offlineFor != null;
  const free = freeSeats(room.zones, counts);
  const freeColor = offline
    ? "var(--state-unknown)"
    : free > 0
      ? "var(--state-empty)"
      : "var(--state-full)";
  const hasZones = room.zones.length > 0;

  return (
    <div className={cn("px-4 py-3", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3">
        <button
          type="button"
          className="row-span-2 min-w-0 text-left"
          disabled={!hasZones}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <div className="break-words text-[15px] font-medium">
            <Highlight text={room.name} query={query} />
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-[13px] w-32" />
          ) : (
            <div className={cn("text-[13px]", offline ? "text-state-full" : "text-muted-foreground")}>
              {offline ? `Camera unit offline, ${offlineFor}` : roomSummary(room.zones, counts)}
            </div>
          )}
        </button>
        <PinButton pinned={pinned} name={room.name} onClick={onTogglePin} className="row-span-2" />
        <div className="row-span-2 flex w-[104px] items-baseline justify-end gap-1">
          {loading ? (
            <Skeleton className="h-5 w-14" />
          ) : (
            <>
              <span className="font-mono text-xl font-bold tabular-nums" style={{ color: freeColor }}>
                {offline ? "?" : free}
              </span>
              <span className="text-[13px] text-muted-foreground">{offline ? "unknown" : "free"}</span>
            </>
          )}
        </div>
        <Button
          className="row-span-2"
          variant="ghost"
          size="icon-sm"
          aria-label={open ? `Hide spots in ${room.name}` : `Show spots in ${room.name}`}
          aria-expanded={open}
          disabled={!hasZones}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        </Button>
      </div>
      {open && hasZones ? (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {sortPinnedFirst(room.zones, isZonePinned).map((zone) => (
            <ZoneTile
              key={zone.id}
              zone={zone}
              count={counts[zone.id]}
              offlineFor={offlineFor}
              pinned={isZonePinned(zone.id)}
              onTogglePin={() => onToggleZonePin(zone.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
