"use client";

import { useState } from "react";
import Link from "next/link";
import { useClock } from "@/hooks/use-clock";
import { durationText, isOffline } from "@/lib/occupancy";
import { GroupSection, ListFilters } from "@/components/admin/group-section";
import { Highlight } from "@/components/highlight";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AdminRoom, UnitHeartbeat } from "./admin-types";
import { BuildingDialog } from "./building-dialog";

type Filter = "all" | "published" | "draft";

// Areas grouped under collapsible building headers, with a search box and
// a Published / Draft filter. Each row links to the setup page.
export function RoomTable({ rooms }: { rooms: AdminRoom[] }) {
  const now = useClock();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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

  const groups = new Map<string, { id: string; name: string; rooms: AdminRoom[] }>();
  for (const room of visible) {
    const g = groups.get(room.building_id) ?? { id: room.building_id, name: room.building.name, rooms: [] };
    g.rooms.push(room);
    groups.set(room.building_id, g);
  }
  const sorted = [...groups.values()]
    .map((g) => ({ ...g, rooms: [...g.rooms].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
            key={g.id}
            title={g.name}
            query={query}
            action={<BuildingDialog id={g.id} name={g.name} />}
            caption={`${g.rooms.length} ${g.rooms.length === 1 ? "area" : "areas"}, ${published} published`}
          >
            {g.rooms.map((room) => (
              <Link
                key={room.id}
                href={`/admin/areas/${room.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_6rem]"
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
            ))}
          </GroupSection>
        );
      })}
    </div>
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
