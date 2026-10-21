"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicRoom, ZoneCount } from "@/lib/types";
import { roomTitle } from "@/lib/types";
import { durationText, freeSeats, relativeTime } from "@/lib/occupancy";
import { usePins } from "@/lib/pins";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PinButton, RoomRow } from "./room-row";

interface LiveMapProps {
  rooms: PublicRoom[];
  initialCounts: ZoneCount[];
}

type Filter = "all" | "free";

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

  const totalFree = rooms.reduce((sum, r) => sum + (stats.get(r.id)?.free ?? 0), 0);
  const buildingCount = new Set(rooms.map((r) => r.building_id)).size;

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

  if (rooms.length === 0) {
    return (
      <div className="py-16">
        <h1 className="text-2xl font-semibold">No areas yet</h1>
        <p className="mt-1 text-muted-foreground">Areas appear here once staff publish them.</p>
      </div>
    );
  }

  const reconnecting = live.connection === "reconnecting";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[44px] font-semibold leading-none tracking-[-0.02em]">
          <span className={totalFree > 0 ? "text-state-empty" : "text-state-full"}>{totalFree}</span> free {totalFree === 1 ? "seat" : "seats"}
        </h1>
        <p className={cn("mt-2 text-[13px]", reconnecting ? "text-state-shared" : "text-muted-foreground")}>
          {reconnecting
            ? `Reconnecting. Counts from ${durationText(live.latestUpdate, live.now) || "never"} ago`
            : `${rooms.length} ${rooms.length === 1 ? "area" : "areas"} in ${buildingCount} ${
                buildingCount === 1 ? "building" : "buildings"
              }. Updated ${relativeTime(live.latestUpdate, live.now)}`}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Area or building"
          aria-label="Search areas"
          className="sm:max-w-xs"
        />
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="free">Free now</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {visible.length === 0 ? (
        <div className="py-8">
          <p className="text-muted-foreground">
            {q ? `No areas or buildings match "${query.trim()}".` : "No areas with free seats right now."}
          </p>
          {q ? (
            <Button variant="outline" className="mt-3" onClick={() => setQuery("")}>
              Clear search
            </Button>
          ) : null}
        </div>
      ) : null}

      {groups.length > 0 ? (
        <section className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <div key={g.building.id}>
              <div className="bg-accent px-4 py-3">
                <h2 className="flex items-center gap-1 text-xl font-semibold">
                  {g.building.name}
                  <PinButton
                    pinned={g.pinned}
                    name={g.building.name}
                    onClick={() => toggleBuilding(g.building.id)}
                  />
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  {g.free} free in {g.rooms.length} {g.rooms.length === 1 ? "area" : "areas"}
                </p>
              </div>
              <div className="divide-y border-b">
                {g.rooms.map((room) => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    counts={live.countNumbers}
                    offlineFor={stats.get(room.id)?.offlineFor ?? null}
                    pinned={isPinned(room.id)}
                    onTogglePin={() => toggle(room.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
