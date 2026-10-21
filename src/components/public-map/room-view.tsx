"use client";

import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Pin } from "lucide-react";
import { toast } from "sonner";
import type { PublicRoom, ZoneCount } from "@/lib/types";
import { roomPath, roomTitle } from "@/lib/types";
import { clockTime, durationText, freeSeats, relativeTime, roomSummary } from "@/lib/occupancy";
import { usePins } from "@/lib/pins";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ZoneTile } from "./zone-tile";

interface RoomViewProps {
  room: PublicRoom;
  initialCounts: ZoneCount[];
  // The admin preview renders this inside a narrow column with no buttons.
  embedded?: boolean;
}

// The public area page body. Also rendered by the setup page's preview step.
export function RoomView({ room, initialCounts, embedded }: RoomViewProps) {
  const live = useLiveSnapshot([room], initialCounts);
  const { isPinned, toggle } = usePins();
  const pinned = isPinned(room.id);
  const heartbeat = live.heartbeat(room);
  // A unit that paused sharing reads as offline here. Only the admin says paused.
  const offline = room.zones.length > 0 && (live.roomPaused(room) || live.roomOffline(room));
  const offlineFor = offline ? durationText(heartbeat, live.now) || "never" : null;
  const free = freeSeats(room.zones, live.countNumbers);

  async function share() {
    const url = `${window.location.origin}${roomPath(room)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: roomTitle(room), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied.");
    } catch {
      // Cancelled share sheet, nothing to say.
    }
  }

  return (
    <div className="space-y-8">
      <div>
        {!embedded ? <BackLink href="/" label="Back to map" className="mb-4" /> : null}
        <Link
          href={`/?q=${encodeURIComponent(room.building.name)}`}
          className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
        >
          {room.building.name}
        </Link>
        <h1 className={cn("font-semibold leading-tight", embedded ? "text-2xl" : "text-[32px]")}>{room.name}</h1>
        {room.description ? <p className="mt-1 text-muted-foreground">{room.description}</p> : null}
        {!embedded ? (
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => toggle(room.id, room.building_id)} aria-pressed={pinned}>
              <Pin
                className={cn(pinned && "text-state-empty")}
                fill={pinned ? "currentColor" : "none"}
                aria-hidden
              />
              {pinned ? "Pinned" : "Pin"}
            </Button>
            <Button variant="outline" onClick={share}>
              Share
            </Button>
          </div>
        ) : null}
      </div>

      {room.zones.length === 0 ? (
        <div>
          <h2 className="text-2xl font-semibold">No zones yet</h2>
          <p className="mt-1 text-muted-foreground">
            Staff draw zones in the admin app. Counts appear here after that.
          </p>
        </div>
      ) : (
        <>
          <div>
            {offline ? (
              <>
                <h2 className="text-[44px] font-semibold leading-none tracking-[-0.02em] text-state-full">
                  Camera unit offline
                </h2>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {heartbeat
                    ? `Last update ${clockTime(heartbeat)}, ${offlineFor} ago. Counts below are from then.`
                    : "No update yet from the camera unit."}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-[44px] font-semibold leading-none tracking-[-0.02em]">
                  <span className={free > 0 ? "text-state-empty" : "text-state-full"}>{free}</span> free {free === 1 ? "seat" : "seats"}
                </h2>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {roomSummary(room.zones, live.countNumbers)}. Updated {relativeTime(heartbeat, live.now)}
                </p>
              </>
            )}
          </div>
          <div
            className={cn(
              "grid gap-3",
              embedded
                ? "grid-cols-[repeat(auto-fill,minmax(130px,1fr))]"
                : "grid-cols-[repeat(auto-fill,minmax(165px,1fr))]"
            )}
          >
            {room.zones.map((zone) => (
              <ZoneTile
                key={zone.id}
                zone={zone}
                count={live.countNumbers[zone.id]}
                offlineFor={offlineFor}
                size={embedded ? "sm" : "md"}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
