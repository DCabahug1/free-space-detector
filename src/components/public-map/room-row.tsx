"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicRoom } from "@/lib/types";
import { freeSeats, roomSummary, seatLevel, totalSeats } from "@/lib/occupancy";
import { Skeleton } from "@/components/ui/skeleton";
import { ZoneTile } from "./zone-tile";
import { FreePill } from "./count-pill";
import { Collapse } from "./collapse";
import { Highlight } from "@/components/highlight";

interface RoomRowProps {
  room: PublicRoom;
  counts: Record<string, number | undefined>;
  // "4 min" while the camera unit is offline, otherwise null.
  offlineFor: string | null;
  // "just now" or "4 min ago" from the newest heartbeat, "" before the clock starts.
  updated?: string;
  // The clock has not started: placeholders stand in for the count and caption.
  loading?: boolean;
  // Search text to highlight in the name.
  query?: string;
  className?: string;
}

// One directory row: name over the seats caption on the left, the free
// seats in a pill on the right (with the update time under it once that
// is a minute or more old), then a chevron. The whole row opens the area's spots as tiles
// beneath it. Closed by default. Spots keep the admin's order. Hairlines
// come from the parent (divide-y).
export function RoomRow({ room, counts, offlineFor, updated = "", loading = false, query = "", className }: RoomRowProps) {
  const [open, setOpen] = useState(false);
  const offline = offlineFor != null;
  const free = freeSeats(room.zones, counts);
  const level = seatLevel(free, totalSeats(room.zones), offline);
  const hasZones = room.zones.length > 0;

  return (
    <div className={cn("transition-colors duration-300", open && "bg-muted/40", className)}>
      <button
        type="button"
        className={cn(
          "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-3.5 sm:gap-x-4 sm:px-5 text-left transition-colors",
          hasZones && "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
        )}
        disabled={!hasZones}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} spots in ${room.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "break-words text-[15px] font-medium leading-snug transition-colors",
              level === "full" && "text-muted-foreground"
            )}
          >
            <Highlight text={room.name} query={query} />
          </span>
          {loading ? (
            <Skeleton className="h-[13px] w-32" />
          ) : (
            <span
              className={cn("text-[13px]", level === "empty" ? "font-medium text-primary" : "text-muted-foreground")}
            >
              {offline ? `Camera unit offline, ${offlineFor}` : roomSummary(room.zones, counts)}
            </span>
          )}
        </span>
        {/* Same column widths as the building header, so pills and
            chevrons line up down the card. */}
        <span className="flex flex-col items-end gap-1 sm:w-[104px]">
          {loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <>
              <FreePill level={level} free={free} />
              {/* The hero carries "Updated just now" for the campus, so a
                  row only speaks up once its own update falls behind. */}
              {!offline && updated && updated !== "just now" ? (
                <span className="text-[11px] leading-none text-muted-foreground/80">{updated}</span>
              ) : null}
            </>
          )}
        </span>
        <span className="flex w-8 justify-center">
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-300",
              open && "rotate-180",
              !hasZones && "opacity-40"
            )}
            aria-hidden
          />
        </span>
      </button>
      {hasZones ? (
        <Collapse open={open}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5 px-4 pt-1 pb-4 sm:gap-3 sm:px-5 sm:pb-5">
            {room.zones.map((zone) => (
              <ZoneTile key={zone.id} zone={zone} count={counts[zone.id]} offlineFor={offlineFor} />
            ))}
          </div>
        </Collapse>
      ) : null}
    </div>
  );
}
