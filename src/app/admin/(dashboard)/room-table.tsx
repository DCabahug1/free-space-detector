"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { reorderRooms } from "@/app/admin/actions";
import { useClock } from "@/hooks/use-clock";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { durationText, isOffline } from "@/lib/occupancy";
import { GroupSection, ListFilters } from "@/components/admin/group-section";
import { Highlight } from "@/components/highlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Building } from "@/lib/types";
import type { AdminRoom, UnitHeartbeat } from "./admin-types";
import { AddAreaDialog } from "./add-area-dialog";
import { BuildingDialog } from "./building-dialog";

type Filter = "all" | "published" | "draft";

// Every building as a collapsible header, its areas as rows beneath, with a
// search box and a Published / Draft filter. A building with no areas shows
// one line and the Add area action. Each area row links to the setup page.
export function RoomTable({ rooms, buildings }: { rooms: AdminRoom[]; buildings: Building[] }) {
  const now = useClock();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // The dragged order per building, shown at once while the server saves it.
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [, startTransition] = useTransition();

  function saveOrder(buildingId: string, ids: string[]) {
    setOrders((o) => ({ ...o, [buildingId]: ids }));
    startTransition(async () => {
      const result = await reorderRooms(buildingId, ids);
      if (result.error) {
        toast(result.error);
        setOrders((o) => {
          const next = { ...o };
          delete next[buildingId];
          return next;
        });
        return;
      }
      router.refresh();
    });
  }

  const q = query.trim().toLowerCase();
  const visible = rooms.filter((room) => {
    if (filter === "published" && !room.published) return false;
    if (filter === "draft" && room.published) return false;
    if (!q) return true;
    return (
      room.name.toLowerCase().includes(q) ||
      room.building.name.toLowerCase().includes(q) ||
      (room.description ?? "").toLowerCase().includes(q)
    );
  });

  // A building stays in the list while any of its areas match, or, with no
  // Published / Draft filter, while its own name matches the search.
  // Areas keep the admin's order (sort_order), with a drag in flight on top.
  const position = (r: AdminRoom) => {
    const dragged = orders[r.building_id]?.indexOf(r.id) ?? -1;
    return dragged >= 0 ? dragged : r.sort_order;
  };
  const sorted = buildings
    .map((b) => ({
      building: b,
      rooms: visible.filter((r) => r.building_id === b.id).sort((a, c) => position(a) - position(c) || a.name.localeCompare(c.name)),
      total: rooms.filter((r) => r.building_id === b.id).length,
    }))
    .filter((g) => g.rooms.length > 0 || (filter === "all" && (!q || g.building.name.toLowerCase().includes(q))))
    .sort((a, b) => a.building.name.localeCompare(b.building.name));

  // Where the location map opens for a building without one.
  const located = buildings.find((b) => b.lat != null && b.lng != null);
  const fallbackCenter = located && located.lat != null && located.lng != null ? { lat: located.lat, lng: located.lng } : null;

  return (
    <div className="space-y-6">
      <ListFilters>
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
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
          </TabsList>
        </Tabs>
      </ListFilters>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q ? `No areas or buildings match "${query.trim()}".` : "No areas match this filter."}
        </p>
      ) : null}

      {sorted.map((g) => {
        const published = g.rooms.filter((r) => r.published).length;
        return (
          <GroupSection
            key={g.building.id}
            title={g.building.name}
            query={query}
            action={
              <>
                <AddAreaDialog building={g.building} />
                <BuildingDialog building={g.building} areaCount={g.total} fallbackCenter={fallbackCenter} />
              </>
            }
            caption={
              g.total === 0
                ? "No areas"
                : `${g.rooms.length} ${g.rooms.length === 1 ? "area" : "areas"}, ${published} published`
            }
          >
            {g.rooms.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted-foreground">No areas yet. Add one with the button above.</p>
            ) : null}
            <AreaRows
              rooms={g.rooms}
              now={now}
              query={query}
              canReorder={!q && filter === "all" && g.rooms.length > 1}
              onReorder={(ids) => saveOrder(g.building.id, ids)}
            />
          </GroupSection>
        );
      })}
    </div>
  );
}

interface AreaRowsProps {
  rooms: AdminRoom[];
  now: number;
  query: string;
  // Only the full, unfiltered list can be dragged, so positions mean something.
  canReorder: boolean;
  onReorder: (ids: string[]) => void;
}

// The rows of one building. A grip at the left drags a row to a new
// position; a drop line shows where it lands. Up and down buttons do the
// same without a mouse.
function AreaRows({ rooms, now, query, canReorder, onReorder }: AreaRowsProps) {
  const ids = rooms.map((r) => r.id);
  const { itemProps, move, dragging, over } = useDragReorder(ids, onReorder);
  return (
    <>
      {rooms.map((room, i) => (
        <div
          key={room.id}
          {...(canReorder ? itemProps(room.id) : {})}
          className={cn(
            "relative grid grid-cols-[auto_minmax(0,1fr)] items-center",
            dragging === room.id && "opacity-50",
            over === room.id && "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary"
          )}
        >
          {canReorder ? (
            <div className="flex items-center pl-2 text-muted-foreground">
              <GripVertical className="size-4 cursor-grab" aria-hidden />
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-4 w-5 rounded-sm"
                  aria-label={`Move ${room.name} up`}
                  disabled={i === 0}
                  onClick={() => move(room.id, -1)}
                >
                  <span aria-hidden className="text-[10px] leading-none">▲</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-4 w-5 rounded-sm"
                  aria-label={`Move ${room.name} down`}
                  disabled={i === rooms.length - 1}
                  onClick={() => move(room.id, 1)}
                >
                  <span aria-hidden className="text-[10px] leading-none">▼</span>
                </Button>
              </div>
            </div>
          ) : (
            <span />
          )}
          <Link
            href={`/admin/areas/${room.id}`}
            draggable={false}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_6rem]"
          >
                <div className="min-w-0">
                  <div className="break-words text-[15px] font-medium">
                    <Highlight text={room.name} query={query} />
                  </div>
                  {room.description ? (
                    <div className="break-words text-[13px] text-muted-foreground">
                      <Highlight text={room.description} query={query} />
                    </div>
                  ) : null}
                </div>
                <div className="col-start-1 text-[13px] sm:col-start-auto">
                  <UnitStatus units={room.units} now={now} />
                </div>
                <div className="col-start-1 text-[13px] text-muted-foreground sm:col-start-auto">
                  {room.zoneCount === 1 ? "1 zone" : `${room.zoneCount} zones`}
                </div>
                <div className="col-start-2 row-span-3 row-start-1 self-center justify-self-end sm:col-start-auto sm:row-span-1">
                  <Badge variant={room.published ? "outline" : "secondary"}>
                    {room.published ? "Published" : "Draft"}
                  </Badge>
                </div>
          </Link>
        </div>
      ))}
    </>
  );
}

function UnitStatus({ units, now }: { units: UnitHeartbeat[]; now: number }) {
  if (units.length === 0) return <span className="text-state-shared">Not paired</span>;
  const unit = [...units].sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? ""))[0];
  const offline = isOffline(unit.last_seen, now);
  if (unit.paused) {
    return <span className="text-state-shared">{unit.name}, sharing paused</span>;
  }
  return (
    <span className={cn(offline ? "text-state-full" : "text-muted-foreground")}>
      {unit.name},{" "}
      {offline
        ? unit.last_seen
          ? `offline ${durationText(unit.last_seen, now)}`
          : "never seen"
        : `${durationText(unit.last_seen, now)} ago`}
    </span>
  );
}
