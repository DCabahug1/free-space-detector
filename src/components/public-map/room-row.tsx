"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicRoom } from "@/lib/types";
import { roomPath } from "@/lib/types";
import { freeSeats, roomSummary, stateColor, tileState } from "@/lib/occupancy";
import { Button } from "@/components/ui/button";
import { ZoneTile } from "./zone-tile";

interface RoomRowProps {
  room: PublicRoom;
  counts: Record<string, number | undefined>;
  // "4 min" while the camera unit is offline, otherwise null.
  offlineFor: string | null;
  pinned?: boolean;
  className?: string;
}

// One directory row: name, summary caption, free count, a 4 px strip with
// one segment per zone in its state color, and a chevron that opens the
// area's spots as tiles beneath the row. Closed by default. The name links
// to the area page. Hairlines come from the parent (divide-y).
export function RoomRow({ room, counts, offlineFor, pinned, className }: RoomRowProps) {
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3">
        <Link href={roomPath(room)} className="min-w-0 hover:underline">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <span className="truncate">{room.name}</span>
            {pinned ? <Pin className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pinned" /> : null}
          </div>
          <div className={cn("text-[13px]", offline ? "text-state-full" : "text-muted-foreground")}>
            {offline ? `Camera unit offline, ${offlineFor}` : roomSummary(room.zones, counts)}
          </div>
        </Link>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-xl font-bold tabular-nums" style={{ color: freeColor }}>
            {offline ? "?" : free}
          </span>
          <span className="text-[13px] text-muted-foreground">{offline ? "unknown" : "free"}</span>
        </div>
        <Button
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
      {hasZones ? (
        <div className="mt-2 flex h-1 gap-px" aria-hidden>
          {room.zones.map((z) => (
            <span
              key={z.id}
              className="flex-1"
              style={{
                backgroundColor: offline
                  ? "var(--state-unknown)"
                  : stateColor(tileState(z.type, counts[z.id] ?? 0, z.capacity)),
              }}
            />
          ))}
        </div>
      ) : null}
      {open && hasZones ? (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {room.zones.map((zone) => (
            <ZoneTile key={zone.id} zone={zone} count={counts[zone.id]} offlineFor={offlineFor} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
