"use client";

import Link from "next/link";
import { ArrowLeft, Pin } from "lucide-react";
import { toast } from "sonner";
import type { PublicRoom, ZoneCount } from "@/lib/types";
import { roomPath, roomTitle } from "@/lib/types";
import { clockTime, durationText, freeSeats, relativeTime, roomSummary } from "@/lib/occupancy";
import { usePins } from "@/lib/pins";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { Band, Wrap, bandOutlineClass } from "@/components/band";
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
                  embedded ? "text-[26px]" : "text-[44px]"
                )}
              >
                Camera unit offline
              </h2>
              <p className={cn("mt-2 text-muted-foreground", embedded ? "text-[10px]" : "text-[13px]")}>
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
                  embedded ? "text-[26px]" : "text-[44px]"
                )}
              >
                <span className={free > 0 ? "text-state-empty" : "text-state-full"}>{free}</span> free{" "}
                {free === 1 ? "seat" : "seats"}
              </h2>
              <p className={cn("mt-2 text-muted-foreground", embedded ? "text-[10px]" : "text-[13px]")}>
                {roomSummary(room.zones, live.countNumbers)}. Updated {relativeTime(heartbeat, live.now)}
              </p>
            </>
          )}
        </div>
        <div
          className={cn(
            "grid",
            embedded ? "grid-cols-2 gap-1.5" : "grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-2.5"
          )}
        >
          {room.zones.map((zone) => (
            <ZoneTile
              key={zone.id}
              zone={zone}
              count={live.countNumbers[zone.id]}
              offlineFor={offlineFor}
              size={embedded ? "xs" : "md"}
            />
          ))}
        </div>
      </>
    );

  if (embedded) {
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

  return (
    <>
      <Band className="pt-5 pb-9">
        <Wrap className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <Link
              href="/"
              className="mb-4 flex h-8 w-fit items-center gap-1.5 text-sm text-band-muted hover:text-band-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to map
            </Link>
            <Link
              href={`/?q=${encodeURIComponent(room.building.name)}`}
              className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-band-muted hover:text-band-foreground"
            >
              {room.building.name}
            </Link>
            <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">{room.name}</h1>
            {room.description ? <p className="mt-1 text-sm text-band-muted">{room.description}</p> : null}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className={bandOutlineClass}
              onClick={() => toggle(room.id, room.building_id)}
              aria-pressed={pinned}
            >
              <Pin className={cn(pinned && "text-band-accent")} fill={pinned ? "currentColor" : "none"} aria-hidden />
              {pinned ? "Pinned" : "Pin"}
            </Button>
            <Button variant="outline" className={bandOutlineClass} onClick={share}>
              Share
            </Button>
          </div>
        </Wrap>
      </Band>
      <Wrap className="flex flex-col gap-6 pt-6 pb-12">{body}</Wrap>
    </>
  );
}
