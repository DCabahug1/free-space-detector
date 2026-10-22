"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { Building, PublicRoom, ZoneCount } from "@/lib/types";
import { roomTitle } from "@/lib/types";
import { buildingState, durationText, freeSeats, stateColor, type BuildingState } from "@/lib/occupancy";
import { distanceMeters, distanceText } from "@/lib/geo";
import { usePins } from "@/lib/pins";
import { useSortPref } from "@/lib/prefs";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { Band, Wrap } from "@/components/band";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PinButton } from "./pin-button";
import { RoomRow } from "./room-row";
import { CampusMap, type MapPin } from "./campus-map";
import { Highlight } from "@/components/highlight";

interface LiveMapProps {
  rooms: PublicRoom[];
  initialCounts: ZoneCount[];
}

type Filter = "all" | "free";

interface Group {
  building: Building;
  rooms: PublicRoom[];
  free: number;
  // Every camera unit in the building is offline, so the total is unknown.
  offline: boolean;
  state: BuildingState;
  // Metres from the person, when Nearest is on and the building has a location.
  distance: number | null;
  pinned: boolean;
}

// The public map: hero band with the headline and the live line, the campus
// map, then the search, the Free now filter and the Nearest sort, and the
// building directory as a Pinned list and an All buildings list.
export function LiveMap({ rooms, initialCounts }: LiveMapProps) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useSortPref();
  const geo = useGeolocation();
  const live = useLiveSnapshot(rooms, initialCounts);
  const { isPinned, toggle, isBuildingPinned, toggleBuilding, isZonePinned, toggleZone } = usePins();
  const zoneIdsOf = (list: PublicRoom[]) => list.flatMap((r) => r.zones.map((z) => z.id));
  // A pin tap on the map opens that building in the All buildings list.
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null);

  // Nearest kept from an earlier visit: ask for the position again. The
  // browser remembers the answer, so there is no second prompt.
  const nearest = sort === "nearest";
  const { status: geoStatus, request: requestGeo } = geo;
  useEffect(() => {
    if (nearest && geoStatus === "idle") requestGeo();
  }, [nearest, geoStatus, requestGeo]);
  useEffect(() => {
    if (!nearest) return;
    if (geoStatus === "denied") {
      toast("Location is off for this site.");
      setSort("free");
    } else if (geoStatus === "unavailable") {
      toast("Location is not available.");
      setSort("free");
    }
  }, [nearest, geoStatus, setSort]);
  const position = nearest ? geo.position : null;

  function toggleNearest() {
    if (nearest) {
      setSort("free");
      geo.stop();
    } else {
      setSort("nearest");
      geo.request();
    }
  }

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

  // Areas within a building: pinned, then free seats (most first), then
  // occupied, then offline. Buildings: by distance while Nearest is on,
  // otherwise offline last and free seats first. Pins have their own list.
  const groups = (() => {
    const byBuilding = new Map<string, { building: Building; rooms: PublicRoom[] }>();
    for (const room of visible) {
      const g = byBuilding.get(room.building_id) ?? { building: room.building, rooms: [] };
      g.rooms.push(room);
      byBuilding.set(room.building_id, g);
    }
    const freeOf = (r: PublicRoom) => stats.get(r.id)?.free ?? 0;
    const pinOf = (r: PublicRoom) => (isPinned(r.id) ? 1 : 0);
    const offlineOf = (r: PublicRoom) => (stats.get(r.id)?.offlineFor != null ? 1 : 0);
    return [...byBuilding.values()].map((g): Group => {
      const offline = g.rooms.every((r) => offlineOf(r) === 1);
      const liveZones = g.rooms.filter((r) => offlineOf(r) === 0).flatMap((r) => r.zones);
      const b = g.building;
      return {
        building: b,
        rooms: [...g.rooms].sort(
          (a, c) =>
            pinOf(c) - pinOf(a) ||
            offlineOf(a) - offlineOf(c) ||
            freeOf(c) - freeOf(a) ||
            a.name.localeCompare(c.name)
        ),
        free: g.rooms.reduce((sum, r) => sum + freeOf(r), 0),
        offline,
        state: buildingState(liveZones, live.countNumbers, offline),
        distance:
          position && b.lat != null && b.lng != null ? distanceMeters(position, { lat: b.lat, lng: b.lng }) : null,
        pinned: isBuildingPinned(b.id),
      };
    });
  })();
  const sortGroups = (list: Group[]) =>
    [...list].sort((a, b) =>
      position
        ? (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.building.name.localeCompare(b.building.name)
        : Number(a.offline) - Number(b.offline) || b.free - a.free || a.building.name.localeCompare(b.building.name)
    );
  const allGroups = sortGroups(groups);
  const pinnedGroups = sortGroups(groups.filter((g) => g.pinned));

  const pins: MapPin[] = allGroups.flatMap((g) =>
    g.building.lat != null && g.building.lng != null
      ? [
          {
            id: g.building.id,
            name: g.building.name,
            lat: g.building.lat,
            lng: g.building.lng,
            state: g.state,
            free: g.free,
            offline: g.offline,
          },
        ]
      : []
  );

  const reconnecting = live.connection === "reconnecting";

  const renderGroup = (g: Group, inAll: boolean) => (
    <BuildingGroup
      key={g.building.id}
      name={g.building.name}
      areaCount={g.rooms.length}
      free={g.free}
      offline={g.offline}
      state={g.state}
      distance={g.distance}
      pinned={g.pinned}
      onTogglePin={() => toggleBuilding(g.building.id, g.rooms.map((r) => r.id), zoneIdsOf(g.rooms))}
      forceOpen={q.length > 0}
      focus={inAll && focus?.id === g.building.id ? focus.tick : null}
      query={query}
    >
      {g.rooms.map((room) => (
        <RoomRow
          key={room.id}
          room={room}
          counts={live.countNumbers}
          offlineFor={stats.get(room.id)?.offlineFor ?? null}
          pinned={isPinned(room.id)}
          onTogglePin={() => toggle(room.id, room.building_id, zoneIdsOf([room]))}
          isZonePinned={isZonePinned}
          onToggleZonePin={(zoneId) => toggleZone(zoneId, room.id, room.building_id)}
          query={query}
        />
      ))}
    </BuildingGroup>
  );

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
            <p className="text-[13px] text-band-muted">Live seat availability across campus.</p>
          )}
        </Wrap>
      </Band>

      {rooms.length === 0 ? (
        <Wrap className="flex flex-col gap-1 py-16">
          <h2 className="text-2xl font-semibold leading-tight">No areas yet</h2>
          <p className="text-[15px] text-muted-foreground">Areas appear here once staff publish them.</p>
        </Wrap>
      ) : (
        <Wrap className="flex flex-col gap-6 pt-6 pb-12">
          <CampusMap
            pins={pins}
            position={position}
            onSelect={(id) => setFocus((f) => ({ id, tick: (f?.tick ?? 0) + 1 }))}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Area or building"
              aria-label="Search areas"
              className="w-full sm:max-w-xs"
            />
            <div className="flex items-center justify-between gap-3">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="free">Free now</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant={nearest ? "default" : "outline"}
                aria-pressed={nearest}
                disabled={nearest && geo.status === "locating"}
                onClick={toggleNearest}
              >
                {nearest && geo.status === "locating" ? "Finding you" : "Nearest"}
              </Button>
            </div>
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

          {pinnedGroups.length > 0 ? (
            <>
              <DirectorySection title="Pinned" collapsible>
                {pinnedGroups.map((g) => renderGroup(g, false))}
              </DirectorySection>
              <DirectorySection title="All buildings">{allGroups.map((g) => renderGroup(g, true))}</DirectorySection>
            </>
          ) : allGroups.length > 0 ? (
            <section className="flex flex-col gap-4">{allGroups.map((g) => renderGroup(g, true))}</section>
          ) : null}
        </Wrap>
      )}
    </>
  );
}

interface DirectorySectionProps {
  title: string;
  // The Pinned list can be folded away. Open by default.
  collapsible?: boolean;
  children: React.ReactNode;
}

// A titled run of building groups. Only shown once there is a Pinned list,
// so a first visit sees one plain list.
function DirectorySection({ title, collapsible, children }: DirectorySectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex h-8 items-center justify-between">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{title}</h2>
        {collapsible ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? `Hide ${title.toLowerCase()}` : `Show ${title.toLowerCase()}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
          </Button>
        ) : null}
      </div>
      {open ? <div className="flex flex-col gap-4">{children}</div> : null}
    </section>
  );
}

interface BuildingGroupProps {
  name: string;
  areaCount: number;
  free: number;
  offline: boolean;
  state: BuildingState;
  distance: number | null;
  pinned: boolean;
  onTogglePin: () => void;
  // A search keeps every matching building open so its results show.
  forceOpen: boolean;
  // A pin tap on the map: opens the group and scrolls it into view. The
  // number changes on every tap so a second tap on the same pin works.
  focus: number | null;
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
  state,
  distance,
  pinned,
  onTogglePin,
  forceOpen,
  focus,
  query,
  children,
}: BuildingGroupProps) {
  const [opened, setOpened] = useState(false);
  const [seenFocus, setSeenFocus] = useState<number | null>(null);
  const ref = useRef<HTMLElement>(null);
  if (focus != null && focus !== seenFocus) {
    setSeenFocus(focus);
    setOpened(true);
  }
  useEffect(() => {
    if (focus != null) ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focus]);
  const open = opened || forceOpen;
  const freeColor = stateColor(state);
  const caption = `${areaCount} ${areaCount === 1 ? "area" : "areas"}${distance != null ? `, ${distanceText(distance)}` : ""}`;
  return (
    <section
      ref={ref}
      className="scroll-mt-4 overflow-hidden rounded-lg border border-building-border bg-card text-card-foreground"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 bg-building px-4 py-3 text-building-foreground">
        <h2 className="min-w-0 break-words text-xl font-semibold tracking-[-0.01em]">
          <Highlight text={name} query={query} />
        </h2>
        <p className="col-start-1 row-start-2 text-[13px] text-building-muted">{caption}</p>
        <PinButton
          pinned={pinned}
          name={name}
          onClick={onTogglePin}
          className="row-span-2 text-building-muted hover:bg-background dark:hover:bg-background"
          pinnedClassName="text-building-foreground"
        />
        <div className="row-span-2 flex w-[104px] items-baseline justify-end gap-1">
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
