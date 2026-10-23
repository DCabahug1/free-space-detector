"use client";

import type { PublicRoom } from "@/lib/types";
import { clockTime, durationText, freeSeats, relativeTime, roomSummary } from "@/lib/occupancy";
import type { LiveSnapshot } from "@/hooks/use-live-snapshot";
import { cn } from "@/lib/utils";
import { ZoneTile } from "./zone-tile";

interface RoomViewProps {
  room: PublicRoom;
  // The setup page's own live snapshot, so the preview shows exactly what
  // the zone editor showed a moment ago.
  live: LiveSnapshot;
}

// The setup page's preview: the area as the public map shows it, in a
// narrow column with no buttons. The area page itself is gone; its old URL
// redirects to the map.
export function RoomView({ room, live }: RoomViewProps) {
  const heartbeat = live.heartbeat(room);
  // A unit that paused sharing reads as offline here. Only the admin says paused.
  const offline = room.zones.length > 0 && (live.roomPaused(room) || live.roomOffline(room));
  const offlineFor = offline ? durationText(heartbeat, live.now) || "never" : null;
  const free = freeSeats(room.zones, live.countNumbers);

  const body =
    room.zones.length === 0 ? (
      <div>
        <h2 className="text-2xl font-semibold leading-tight">No zones yet</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Staff draw zones in the admin app. Counts appear here after that.
        </p>
      </div>
    ) : (
      <>
        <div>
          {offline ? (
            <>
              <h2
                className={cn(
                  "font-semibold leading-none tracking-[-0.02em] text-state-full",
                  "text-[26px]"
                )}
              >
                Camera unit offline
              </h2>
              <p className={cn("mt-2 text-muted-foreground", "text-[10px]")}>
                {heartbeat
                  ? `Last update ${clockTime(heartbeat)}, ${offlineFor} ago.`
                  : "No update yet from the camera unit."}
              </p>
            </>
          ) : (
            <>
              <h2
                className={cn(
                  "font-semibold leading-none tracking-[-0.02em]",
                  "text-[26px]"
                )}
              >
                <span className={free > 0 ? "text-state-empty" : "text-state-full"}>{free}</span> free{" "}
                {free === 1 ? "seat" : "seats"}
              </h2>
              <p className={cn("mt-2 text-muted-foreground", "text-[10px]")}>
                {roomSummary(room.zones, live.countNumbers)}. Updated {relativeTime(heartbeat, live.now)}
              </p>
            </>
          )}
        </div>
        <div
          className="grid grid-cols-2 gap-1.5"
        >
          {room.zones.map((zone) => (
            <ZoneTile
              key={zone.id}
              zone={zone}
              count={live.countNumbers[zone.id]}
              offlineFor={offlineFor}
              size="xs"
            />
          ))}
        </div>
      </>
    );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{room.building.name}</div>
        <div className="text-lg font-semibold tracking-[-0.01em]">{room.name}</div>
      </div>
      {body}
    </div>
  );
}
