"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PublicRoom, ZoneCount } from "@/lib/types";
import { roomPath, roomTitle } from "@/lib/types";
import { durationText, freeSeats, relativeTime, roomSummary } from "@/lib/occupancy";
import { usePins } from "@/lib/pins";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { RoomRow } from "./room-row";
import { ZoneTile } from "./zone-tile";

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
  const { pins, isPinned } = usePins();

  // Per room: free seats and whether its camera unit is offline.
  const stats = new Map<string, { free: number; offlineFor: string | null }>();
  for (const room of rooms) {
    const offline = live.roomOffline(room);
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

  const pinned = pins
    .map((id) => visible.find((r) => r.id === id))
    .filter((r): r is PublicRoom => Boolean(r));

  // Directory: buildings by free seats, rooms by free seats.
  const groups = (() => {
    const byBuilding = new Map<string, { building: PublicRoom["building"]; rooms: PublicRoom[] }>();
    for (const room of visible) {
      const g = byBuilding.get(room.building_id) ?? { building: room.building, rooms: [] };
      g.rooms.push(room);
      byBuilding.set(room.building_id, g);
    }
    const freeOf = (r: PublicRoom) => stats.get(r.id)?.free ?? 0;
    return [...byBuilding.values()]
      .map((g) => ({
        ...g,
        rooms: [...g.rooms].sort((a, b) => freeOf(b) - freeOf(a) || a.name.localeCompare(b.name)),
        free: g.rooms.reduce((sum, r) => sum + freeOf(r), 0),
      }))
      .sort((a, b) => b.free - a.free || a.building.name.localeCompare(b.building.name));
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
          <span className="text-state-empty">{totalFree}</span> free seats
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

      {pinned.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Pinned
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {pinned.map((room) => {
              const s = stats.get(room.id)!;
              return (
                <div key={room.id} className="space-y-3">
                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={roomPath(room)} className="block truncate text-[15px] font-medium hover:underline">
                        {roomTitle(room)}
                      </Link>
                      <p className={cn("text-[13px]", s.offlineFor ? "text-state-full" : "text-muted-foreground")}>
                        {s.offlineFor
                          ? `Camera unit offline, ${s.offlineFor}`
                          : roomSummary(room.zones, live.countNumbers)}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className="font-mono text-xl font-bold tabular-nums"
                        style={{
                          color: s.offlineFor
                            ? "var(--state-unknown)"
                            : s.free > 0
                              ? "var(--state-empty)"
                              : "var(--state-full)",
                        }}
                      >
                        {s.offlineFor ? "?" : s.free}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {s.offlineFor ? "unknown" : "free"}
                      </span>
                    </div>
                  </div>
                  {room.zones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No zones yet</p>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                      {room.zones.map((zone) => (
                        <ZoneTile
                          key={zone.id}
                          zone={zone}
                          count={live.countNumbers[zone.id]}
                          offlineFor={s.offlineFor}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {groups.length > 0 ? (
        <section className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <div key={g.building.id}>
              <h2 className="text-xl font-semibold">{g.building.name}</h2>
              <p className="text-[13px] text-muted-foreground">
                {g.free} free in {g.rooms.length} {g.rooms.length === 1 ? "area" : "areas"}
              </p>
              <div className="mt-2 divide-y border-t">
                {g.rooms.map((room) => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    counts={live.countNumbers}
                    offlineFor={stats.get(room.id)?.offlineFor ?? null}
                    className={isPinned(room.id) ? "" : undefined}
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
