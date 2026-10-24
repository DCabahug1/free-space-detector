"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { Building, PublicRoom, ZoneCount } from "@/lib/types";
import { roomTitle } from "@/lib/types";
import { buildingState, durationText, freeSpots, relativeTime, type BuildingState } from "@/lib/occupancy";
import { distanceMeters, distanceText } from "@/lib/geo";
import { usePins } from "@/lib/pins";
import { useSortPref } from "@/lib/prefs";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { Wrap } from "@/components/band";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { PinButton } from "./pin-button";
import { RoomRow } from "./room-row";
import { FreePill } from "./count-pill";
import { Collapse } from "./collapse";
import { SeatMap, type SeatMapBuilding } from "./seat-map";
import { CampusMap, mapAvailable, type MapPin } from "./campus-map";
import { Highlight } from "@/components/highlight";

interface LiveMapProps {
  rooms: PublicRoom[];
  initialCounts: ZoneCount[];
}

type Filter = "all" | "available" | "occupied";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
];

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

// The public map, split in two on wide screens. Left: the hero (headline,
// campus spot total, update time), the street map, the All / Available /
// Occupied tabs, the search and the Nearest sort, then the building
// directory as a Pinned list and an All buildings list. Right, sticky: the
// seat map. On a phone the seat map follows the list.
export function LiveMap({ rooms, initialCounts }: LiveMapProps) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useSortPref();
  const geo = useGeolocation();
  const live = useLiveSnapshot(rooms, initialCounts);
  const { isBuildingPinned, toggleBuilding } = usePins();
  // A pin tap on the map opens that building in the All buildings list.
  // A one-off request to open and scroll to a building, cleared once the
  // header pulse is done, so a card that remounts later (after a tab
  // switch) does not scroll the page again.
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null);
  // The building highlighted on the seat map; a second click clears it.
  const [selected, setSelected] = useState<string | null>(null);
  // View on map in a building header zooms the map to that building.
  const [mapTarget, setMapTarget] = useState<{ id: string; tick: number } | null>(null);

  // The position is asked for on load so the map can center on the
  // person; the browser remembers the answer. Nearest kept from an earlier
  // visit falls back to free tables quietly when location is off.
  const nearest = sort === "nearest";
  const { status: geoStatus, request: requestGeo } = geo;
  useEffect(() => {
    requestGeo();
  }, [requestGeo]);
  useEffect(() => {
    if (nearest && (geoStatus === "denied" || geoStatus === "unavailable")) setSort("free");
  }, [nearest, geoStatus, setSort]);
  const position = geo.position;

  function toggleNearest() {
    if (nearest) {
      setSort("free");
      return;
    }
    if (geoStatus === "denied") {
      toast("Location is off for this site.");
      return;
    }
    if (geoStatus === "unavailable") {
      toast("Location is not available.");
      return;
    }
    setSort("nearest");
    if (geoStatus === "idle") requestGeo();
  }

  // Per room: free spots and whether its camera unit is offline.
  // A unit that paused sharing reads as offline here. Only the admin says paused.
  const stats = new Map<string, { free: number; offlineFor: string | null }>();
  for (const room of rooms) {
    const offline = live.roomPaused(room) || live.roomOffline(room);
    stats.set(room.id, {
      free: offline ? 0 : freeSpots(room.zones, live.countNumbers),
      offlineFor: offline ? durationText(live.heartbeat(room), live.now) || "never" : null,
    });
  }

  // Available: reporting with a free spot. Occupied: reporting with none.
  // An offline area is neither, so it shows under All only.
  const q = query.trim().toLowerCase();
  const matches = rooms.filter(
    (room) =>
      !q ||
      room.name.toLowerCase().includes(q) ||
      room.building.name.toLowerCase().includes(q) ||
      roomTitle(room).toLowerCase().includes(q)
  );
  const inFilter = (room: PublicRoom, f: Filter) => {
    const st = stats.get(room.id);
    if (f === "all" || !st) return true;
    if (st.offlineFor != null) return false;
    return f === "available" ? st.free > 0 : st.free === 0;
  };
  const filterCounts: Record<Filter, number> = {
    all: matches.length,
    available: matches.filter((r) => inFilter(r, "available")).length,
    occupied: matches.filter((r) => inFilter(r, "occupied")).length,
  };
  const visible = matches.filter((room) => inFilter(room, filter));

  // Areas within a building keep the admin's order. Buildings: by distance
  // while Nearest is on, otherwise offline last and free spots first. Pins
  // have their own list.
  const buildGroups = (list: PublicRoom[]) => {
    const byBuilding = new Map<string, { building: Building; rooms: PublicRoom[] }>();
    for (const room of list) {
      const g = byBuilding.get(room.building_id);
      byBuilding.set(room.building_id, {
        building: room.building,
        rooms: g ? [...g.rooms, room] : [room],
      });
    }
    const freeOf = (r: PublicRoom) => stats.get(r.id)?.free ?? 0;
    const offlineOf = (r: PublicRoom) => (stats.get(r.id)?.offlineFor != null ? 1 : 0);
    return [...byBuilding.values()].map((g): Group => {
      const offline = g.rooms.every((r) => offlineOf(r) === 1);
      const liveZones = g.rooms.filter((r) => offlineOf(r) === 0).flatMap((r) => r.zones);
      const b = g.building;
      return {
        building: b,
        rooms: [...g.rooms].sort((a, c) => a.sort_order - c.sort_order || a.name.localeCompare(c.name)),
        free: g.rooms.reduce((sum, r) => sum + freeOf(r), 0),
        offline,
        state: buildingState(liveZones, live.countNumbers, offline),
        distance:
          position && b.lat != null && b.lng != null ? distanceMeters(position, { lat: b.lat, lng: b.lng }) : null,
        pinned: isBuildingPinned(b.id),
      };
    });
  };
  const groups = buildGroups(visible);
  const byNearest = nearest && position != null;
  const sortGroups = (list: Group[]) =>
    [...list].sort((a, b) =>
      byNearest
        ? (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.building.name.localeCompare(b.building.name)
        : Number(a.offline) - Number(b.offline) || b.free - a.free || a.building.name.localeCompare(b.building.name)
    );
  // A pinned building moves to Pinned and leaves All buildings; unpinning
  // puts it back.
  const allGroups = sortGroups(groups.filter((g) => !g.pinned));
  const pinnedGroups = sortGroups(groups.filter((g) => g.pinned));

  // Campus total for the hero, from areas whose camera unit is reporting.
  const campusFree = rooms.reduce((sum, r) => sum + (stats.get(r.id)?.free ?? 0), 0);
  const campusBuildings = new Set(rooms.map((r) => r.building_id)).size;

  // Every building goes to the seat map and every located one to the
  // street map. A search or a tab fades or hides what it leaves out.
  const visibleBuildings = new Set(visible.map((r) => r.building_id));
  const seatBuildings: SeatMapBuilding[] = sortGroups(buildGroups(rooms)).map((g) => ({
    id: g.building.id,
    name: g.building.name,
    free: g.free,
    offline: g.offline,
    shown: visibleBuildings.has(g.building.id),
    zones: g.rooms.flatMap((r) =>
      r.zones
        .filter((z) => z.type === "seating" && z.capacity != null && z.capacity > 0)
        .map((z) => ({
          id: z.id,
          capacity: z.capacity!,
          taken: Math.min(z.capacity!, live.countNumbers[z.id] ?? 0),
        }))
    ),
  }));
  const focusBuilding = (id: string) => {
    setSelected(id);
    const tick = Date.now();
    setFocus({ id, tick });
    setTimeout(() => setFocus((f) => (f?.tick === tick ? null : f)), 1000);
  };
  const toggleSelected = (id: string) => {
    if (selected === id) setSelected(null);
    else focusBuilding(id);
  };
  const pins: MapPin[] = buildGroups(rooms).flatMap((g) =>
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
            shown: visibleBuildings.has(g.building.id),
          },
        ]
      : []
  );

  const reconnecting = live.connection === "reconnecting";
  // Until the client clock starts nothing can be called offline, so counts
  // show a placeholder rather than a number that may flip to unknown.
  const loading = live.now === 0;

  const renderGroup = (g: Group) => (
    <BuildingGroup
      key={g.building.id}
      name={g.building.name}
      areaCount={g.rooms.length}
      free={g.free}
      loading={loading}
      level={g.state}
      distance={g.distance}
      pinned={g.pinned}
      onTogglePin={() => toggleBuilding(g.building.id)}
      onViewOnMap={
        mapAvailable && g.building.lat != null && g.building.lng != null
          ? () => setMapTarget((t) => ({ id: g.building.id, tick: (t?.tick ?? 0) + 1 }))
          : undefined
      }
      forceOpen={q.length > 0}
      focus={focus?.id === g.building.id ? focus.tick : null}
      query={query}
    >
      {g.rooms.map((room) => (
        <RoomRow
          key={room.id}
          room={room}
          counts={live.countNumbers}
          offlineFor={stats.get(room.id)?.offlineFor ?? null}
          updated={relativeTime(live.heartbeat(room), live.now)}
          loading={loading}
          query={query}
        />
      ))}
    </BuildingGroup>
  );

  const hero = (
    <header className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
      <h1 className="text-[40px] font-semibold leading-[0.95] tracking-[-0.03em] text-foreground md:text-[56px]">
        Find a free spot
      </h1>
      <div className="flex flex-col gap-1.5">
        {loading ? (
          <Skeleton className="h-9 w-64" />
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-mono text-[34px] font-bold leading-none tabular-nums text-primary">{campusFree}</span>
            <span className="text-base text-foreground">
              {campusFree === 1 ? "spot" : "spots"} free across {campusBuildings}{" "}
              {campusBuildings === 1 ? "building" : "buildings"}
            </span>
          </p>
        )}
        <p className="text-[13px] text-muted-foreground">
          {reconnecting
            ? `Reconnecting. Counts from ${durationText(live.latestUpdate, live.now) || "never"} ago`
            : loading
              ? "\u00a0"
              : `Updated ${relativeTime(live.latestUpdate, live.now)}`}
        </p>
      </div>
    </header>
  );

  if (rooms.length === 0) {
    return (
      <Wrap className="flex max-w-[1280px] flex-col gap-10 pt-10 pb-16">
        {hero}
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold leading-tight">No areas yet</h2>
          <p className="text-[15px] text-muted-foreground">Areas appear here once staff publish them.</p>
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap className="grid max-w-[1280px] gap-x-12 gap-y-10 pt-10 pb-16 md:pt-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr]">
      {hero}

      <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-2">
        <CampusMap
          pins={pins}
          position={position}
          onRequestPosition={() => {
            if (geoStatus === "denied") toast("Location is off for this site.");
            else if (geoStatus === "unavailable") toast("Location is not available.");
            else requestGeo();
          }}
          onSelect={focusBuilding}
          target={mapTarget}
        />
        <div className="flex flex-col gap-4">
          <TabsPrimitive.Root value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsPrimitive.List aria-label="Filter areas" className="flex gap-6 border-b">
              {FILTERS.map((f) => (
                <TabsPrimitive.Trigger
                  key={f.value}
                  value={f.value}
                  className="group relative -mb-px flex items-baseline gap-2 border-b-2 border-transparent pt-1 pb-3 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none data-[state=active]:border-primary data-[state=active]:text-foreground"
                >
                  {f.label}
                  <span className="font-mono text-xs tabular-nums text-muted-foreground group-data-[state=active]:text-primary">
                    {loading ? "" : filterCounts[f.value]}
                  </span>
                </TabsPrimitive.Trigger>
              ))}
            </TabsPrimitive.List>
          </TabsPrimitive.Root>
          <div className="flex items-center gap-3">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an area or building"
              aria-label="Search areas"
              className="h-10 min-w-0 flex-1 bg-card"
            />
            <Button
              variant={nearest ? "default" : "outline"}
              className="h-10 bg-card"
              aria-pressed={nearest}
              disabled={nearest && geoStatus === "locating"}
              onClick={toggleNearest}
            >
              {nearest && geoStatus === "locating" ? "Finding you" : "Nearest"}
            </Button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col gap-3 pt-6">
            <p className="text-[15px] text-muted-foreground">
              {q
                ? `No areas or buildings match "${query.trim()}".`
                : filter === "occupied"
                  ? "No full areas right now."
                  : "No areas with free spots right now."}
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
              {pinnedGroups.map(renderGroup)}
            </DirectorySection>
            {allGroups.length > 0 ? (
              <DirectorySection title="All buildings">{allGroups.map(renderGroup)}</DirectorySection>
            ) : null}
          </>
        ) : allGroups.length > 0 ? (
          <section className="flex flex-col gap-3">{allGroups.map(renderGroup)}</section>
        ) : null}
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
        <SeatMap buildings={seatBuildings} activeId={selected} onSelect={toggleSelected} loading={loading} />
      </aside>
    </Wrap>
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
    <section className="flex flex-col gap-2">
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
            <ChevronDown className={cn("transition-transform duration-300", open && "rotate-180")} aria-hidden />
          </Button>
        ) : null}
      </div>
      <Collapse open={open}>
        <div className="flex flex-col gap-3">{children}</div>
      </Collapse>
    </section>
  );
}

interface BuildingGroupProps {
  name: string;
  areaCount: number;
  free: number;
  // The clock has not started: a placeholder stands in for the count.
  loading: boolean;
  level: BuildingState;
  distance: number | null;
  pinned: boolean;
  onTogglePin: () => void;
  // Only for a building with a location, while the map can render.
  onViewOnMap?: () => void;
  // A search keeps every matching building open so its results show.
  forceOpen: boolean;
  // A pin tap on the map: opens the group and scrolls it into view. The
  // number changes on every tap so a second tap on the same pin works.
  focus: number | null;
  query: string;
  children: React.ReactNode;
}

// One building in the directory: header on the accent background with the
// pin, name and area count, then the free total and chevron in fixed
// columns so they line up from card to card. Closed by
// default, the same way an area row's spots are.
function BuildingGroup({
  name,
  areaCount,
  free,
  loading,
  level,
  distance,
  pinned,
  onTogglePin,
  onViewOnMap,
  forceOpen,
  focus,
  query,
  children,
}: BuildingGroupProps) {
  const [opened, setOpened] = useState(false);
  // Starts at the current focus, so a card mounted while a request is
  // still live (a tab switch) neither opens nor scrolls for it.
  const [seenFocus, setSeenFocus] = useState<number | null>(focus);
  const ref = useRef<HTMLElement>(null);
  if (focus != null && focus !== seenFocus) {
    setSeenFocus(focus);
    setOpened(true);
  }
  const [mountedFocus] = useState(focus);
  useEffect(() => {
    if (focus != null && focus !== mountedFocus) {
      ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [focus, mountedFocus]);
  const open = opened || forceOpen;
  const caption = `${areaCount} ${areaCount === 1 ? "area" : "areas"}${distance != null ? `, ${distanceText(distance)}` : ""}`;
  return (
    <section
      ref={ref}
      className="scroll-mt-4 overflow-hidden rounded-lg border border-building-border bg-card text-card-foreground"
    >
      {/* The whole header toggles the group, like an area row. The pin,
          View on map and the chevron stop the click so they keep their own jobs. After a
          pin tap the header background pulses once; the key replays the
          animation when the same pin is tapped again. */}
      <div
        key={focus ?? 0}
        onClick={() => {
          if (!forceOpen) setOpened((o) => !o);
        }}
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 bg-building py-4 pr-4 pl-3 text-building-foreground transition-colors sm:gap-x-4 sm:pr-5 sm:pl-4",
          !forceOpen && "cursor-pointer hover:bg-muted/50",
          focus != null && focus !== mountedFocus && "animate-[header-pulse_900ms_ease-out]"
        )}
      >
        <PinButton
          pinned={pinned}
          name={name}
          onClick={onTogglePin}
          className="row-span-2 -ml-2 text-building-muted hover:bg-muted dark:hover:bg-muted"
          pinnedClassName="text-building-foreground"
        />
        <h2
          className={cn(
            "min-w-0 break-words text-lg font-semibold leading-tight tracking-[-0.01em] transition-colors sm:text-xl",
            level === "full" && "text-muted-foreground"
          )}
        >
          <Highlight text={name} query={query} />
        </h2>
        <p className="col-start-2 row-start-2 flex flex-wrap items-baseline gap-x-3 text-[13px] text-building-muted">
          <span>{caption}</span>
          {onViewOnMap ? (
            <button
              type="button"
              aria-label={`View ${name} on map`}
              className="rounded-sm font-medium text-building-foreground underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                onViewOnMap();
              }}
            >
              View on map
            </button>
          ) : null}
        </p>
        <div className="row-span-2 flex items-center justify-end sm:w-[104px]">
          {loading ? (
            <Skeleton className="h-7 w-16 bg-building-border" />
          ) : (
            <>
              <FreePill level={level} free={free} />
            </>
          )}
        </div>
        <Button
          className="row-span-2 text-building-muted hover:bg-muted dark:hover:bg-muted"
          variant="ghost"
          size="icon-sm"
          aria-label={open ? `Hide areas in ${name}` : `Show areas in ${name}`}
          aria-expanded={open}
          disabled={forceOpen}
          onClick={(e) => {
            e.stopPropagation();
            setOpened((o) => !o);
          }}
        >
          <ChevronDown className={cn("transition-transform duration-300", open && "rotate-180")} aria-hidden />
        </Button>
      </div>
      <Collapse open={open}>
        <div className="divide-y border-t">{children}</div>
      </Collapse>
    </section>
  );
}
