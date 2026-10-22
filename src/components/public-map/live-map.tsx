"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { PublicRoom, ZoneCount } from "@/lib/types";
import { roomTitle } from "@/lib/types";
import { durationText, freeSeats } from "@/lib/occupancy";
import { usePins } from "@/lib/pins";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { Band, Wrap } from "@/components/band";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PinButton, RoomRow } from "./room-row";
import { Highlight } from "@/components/highlight";

interface LiveMapProps {
  rooms: PublicRoom[];
  initialCounts: ZoneCount[];
}

type Filter = "all" | "free";

// The public map: hero band with the headline and the live line, then the
// search, the Free now filter, and the building directory.
export function LiveMap({ rooms, initialCounts }: LiveMapProps) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const live = useLiveSnapshot(rooms, initialCounts);
  const { isPinned, toggle, isBuildingPinned, toggleBuilding } = usePins();

  // Per room: free seats and whether its camera unit is offline.
  // A unit that paused sharing reads as offline here. Only the admin says paused.
  const stats = new Map<string, { free: number; offlineFor: string | null }>();
  for (const room of rooms) {
    const offline = live.roomPaused(room) || live.roomOffline(room);
    stats.set(room.id, {
      free: offline ? 0 : freeSeats(room.zones, live.countNumbers),
      offlineFor: offline ? durationText(live.heartbeat(room), live.now) || "never" : null,
    });
  }

  const q = query.trim().toLowerCase();
  const visible = rooms.filter((room) => {
    if (filter === "free" && (stats.get(room.id)?.free ?? 0) === 0) return false;
    if (!q) return true;
    return (
      room.name.toLowerCase().includes(q) ||
      room.building.name.toLowerCase().includes(q) ||
      roomTitle(room).toLowerCase().includes(q)
    );
  });

  // Directory: pinned areas first, then by free seats. A pinned building
  // comes first, then a building with a pinned area, then the rest.
  const groups = (() => {
    const byBuilding = new Map<string, { building: PublicRoom["building"]; rooms: PublicRoom[] }>();
    for (const room of visible) {
      const g = byBuilding.get(room.building_id) ?? { building: room.building, rooms: [] };
      g.rooms.push(room);
      byBuilding.set(room.building_id, g);
    }
    const freeOf = (r: PublicRoom) => stats.get(r.id)?.free ?? 0;
    const pinOf = (r: PublicRoom) => (isPinned(r.id) ? 1 : 0);
    return [...byBuilding.values()]
      .map((g) => ({
        ...g,
        rooms: [...g.rooms].sort(
          (a, b) => pinOf(b) - pinOf(a) || freeOf(b) - freeOf(a) || a.name.localeCompare(b.name)
        ),
        free: g.rooms.reduce((sum, r) => sum + freeOf(r), 0),
        // Every camera unit in the building is offline, so the total is unknown.
        offline: g.rooms.every((r) => stats.get(r.id)?.offlineFor != null),
        pinned: isBuildingPinned(g.building.id),
        rank: isBuildingPinned(g.building.id) ? 2 : g.rooms.some((r) => isPinned(r.id)) ? 1 : 0,
      }))
      .sort(
        (a, b) =>
          b.rank - a.rank ||
          b.free - a.free ||
          a.building.name.localeCompare(b.building.name)
      );
  })();

  const reconnecting = live.connection === "reconnecting";

  return (
    <>
      <Band className="pt-5 pb-9">
        <Wrap className="flex flex-col gap-2.5">
          <h1 className="text-[44px] font-semibold leading-none tracking-[-0.02em]">Find a free spot</h1>
          {reconnecting ? (
            <p className="text-[13px] text-band-stale">
              Reconnecting. Counts from {durationText(live.latestUpdate, live.now) || "never"} ago
            </p>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-band-muted">
              <span className="inline-block size-2 rounded-full bg-band-accent ring-[3px] ring-band-accent/30" aria-hidden />
              <span>Live seat availability across campus.</span>
            </p>
          )}
        </Wrap>
      </Band>

      {rooms.length === 0 ? (
        <Wrap className="flex flex-col gap-1 py-16">
          <h2 className="text-2xl font-semibold leading-tight">No areas yet</h2>
          <p className="text-[15px] text-muted-foreground">Areas appear here once staff publish them.</p>
        </Wrap>
      ) : (
        <Wrap className="flex flex-col gap-8 pt-6 pb-12">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Area or building"
              aria-label="Search areas"
              className="max-w-xs"
            />
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="free">Free now</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col gap-3 pt-8">
              <p className="text-[15px] text-muted-foreground">
                {q ? `No areas or buildings match "${query.trim()}".` : "No areas with free seats right now."}
              </p>
              {q ? (
                <Button variant="outline" className="self-start" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              ) : null}
            </div>
          ) : null}

          {groups.length > 0 ? (
            <section className="flex flex-col gap-4">
              {groups.map((g) => (
                <BuildingGroup
                  key={g.building.id}
                  name={g.building.name}
                  areaCount={g.rooms.length}
                  free={g.free}
                  offline={g.offline}
                  pinned={g.pinned}
                  onTogglePin={() => toggleBuilding(g.building.id, g.rooms.map((r) => r.id))}
                  forceOpen={q.length > 0}
                  query={query}
                >
                  {g.rooms.map((room) => (
                    <RoomRow
                      key={room.id}
                      room={room}
                      counts={live.countNumbers}
                      offlineFor={stats.get(room.id)?.offlineFor ?? null}
                      pinned={isPinned(room.id)}
                      onTogglePin={() => toggle(room.id, room.building_id)}
                      query={query}
                    />
                  ))}
                </BuildingGroup>
              ))}
            </section>
          ) : null}
        </Wrap>
      )}
    </>
  );
}

interface BuildingGroupProps {
  name: string;
  areaCount: number;
  free: number;
  offline: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  // A search keeps every matching building open so its results show.
  forceOpen: boolean;
  query: string;
  children: React.ReactNode;
}

// One building in the directory: header on the accent background with the
// name and area count, then the pin, free total and chevron in fixed
// columns so they line up from card to card. Closed by
// default, the same way an area row's spots are.
function BuildingGroup({
  name,
  areaCount,
  free,
  offline,
  pinned,
  onTogglePin,
  forceOpen,
  query,
  children,
}: BuildingGroupProps) {
  const [opened, setOpened] = useState(false);
  const open = opened || forceOpen;
  const freeColor = offline ? "var(--state-unknown)" : free > 0 ? "var(--state-empty)" : "var(--state-full)";
  return (
    <section className="overflow-hidden rounded-lg border border-building-border bg-card text-card-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 bg-building px-4 py-3 text-building-foreground">
        <h2 className="min-w-0 break-words text-xl font-semibold tracking-[-0.01em]">
          <Highlight text={name} query={query} />
        </h2>
        <p className="col-start-1 row-start-2 text-[13px] text-building-muted">
          {areaCount} {areaCount === 1 ? "area" : "areas"}
        </p>
        <PinButton
          pinned={pinned}
          name={name}
          onClick={onTogglePin}
          className="row-span-2 text-building-muted hover:bg-background dark:hover:bg-background"
          pinnedClassName="text-building-foreground"
        />
        <div className="row-span-2 flex items-baseline gap-1">
          <span className="font-mono text-xl font-bold tabular-nums" style={{ color: freeColor }}>
            {offline ? "?" : free}
          </span>
          <span className="text-[13px] text-building-muted">{offline ? "unknown" : "free"}</span>
        </div>
        <Button
          className="row-span-2 text-building-muted hover:bg-background dark:hover:bg-background"
          variant="ghost"
          size="icon-sm"
          aria-label={open ? `Hide areas in ${name}` : `Show areas in ${name}`}
          aria-expanded={open}
          disabled={forceOpen}
          onClick={() => setOpened((o) => !o)}
        >
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        </Button>
      </div>
      {open ? <div className="divide-y border-t">{children}</div> : null}
    </section>
  );
}
