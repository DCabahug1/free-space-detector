"use client";

import Link from "next/link";
import { useClock } from "@/hooks/use-clock";
import { durationText, isOffline } from "@/lib/occupancy";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminRoom, UnitHeartbeat } from "./admin-types";

// Areas grouped under building labels. Columns: Area, Camera unit, Zones,
// Status. Rows link to the setup page. Hairlines only.
export function RoomTable({ rooms }: { rooms: AdminRoom[] }) {
  const now = useClock();
  const groups = new Map<string, { name: string; rooms: AdminRoom[] }>();
  for (const room of rooms) {
    const g = groups.get(room.building_id) ?? { name: room.building.name, rooms: [] };
    g.rooms.push(room);
    groups.set(room.building_id, g);
  }
  const sorted = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {sorted.map((g) => (
        <div key={g.name}>
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {g.name}
          </div>
          <div className="mt-2 divide-y border-y">
            {g.rooms.map((room) => (
              <Link
                key={room.id}
                href={`/admin/areas/${room.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 hover:bg-card sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{room.name}</div>
                  {room.description ? (
                    <div className="truncate text-[13px] text-muted-foreground">{room.description}</div>
                  ) : null}
                </div>
                <div className="col-start-1 text-[13px] sm:col-start-auto">
                  <UnitStatus units={room.units} now={now} />
                </div>
                <div className="col-start-1 text-[13px] text-muted-foreground sm:col-start-auto">
                  {room.zoneCount === 1 ? "1 zone" : `${room.zoneCount} zones`}
                </div>
                <div className="col-start-2 row-start-1 row-span-3 self-center sm:col-start-auto sm:row-span-1">
                  <Badge variant={room.published ? "outline" : "secondary"}>
                    {room.published ? "Published" : "Draft"}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
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
