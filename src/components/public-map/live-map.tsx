"use client";

import { useEffect, useMemo, useState } from "react";
import { WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Room, Zone, ZoneCount } from "@/lib/types";
import { isStale, relativeTime, roomSummary } from "@/lib/occupancy";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ZoneTile } from "./zone-tile";

export interface RoomWithZones extends Room {
  zones: Zone[];
}

interface LiveMapProps {
  rooms: RoomWithZones[];
  initialCounts: ZoneCount[];
}

type CountMap = Record<string, ZoneCount>;

// Realtime can be blocked on some networks. Poll as a fallback so the
// demo still updates (slowly) if the websocket never connects.
const POLL_MS = 45_000;

export function LiveMap({ rooms, initialCounts }: LiveMapProps) {
  const [counts, setCounts] = useState<CountMap>(() =>
    Object.fromEntries(initialCounts.map((c) => [c.zone_id, c]))
  );
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("public:zone_counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zone_counts" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<ZoneCount>;
            if (!old.zone_id) return;
            setCounts((prev) => {
              const next = { ...prev };
              delete next[old.zone_id!];
              return next;
            });
            return;
          }
          const row = payload.new as ZoneCount;
          setCounts((prev) => ({ ...prev, [row.zone_id]: row }));
        }
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    async function poll() {
      const { data } = await supabase
        .from("zone_counts")
        .select("zone_id, count, updated_at");
      if (data) {
        setCounts(Object.fromEntries(data.map((c) => [c.zone_id, c])));
      }
    }
    const pollTimer = setInterval(poll, POLL_MS);
    const clockTimer = setInterval(() => setNow(Date.now()), 5_000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(clockTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const countNumbers = useMemo(
    () =>
      Object.fromEntries(
        Object.values(counts).map((c) => [c.zone_id, c.count])
      ) as Record<string, number | undefined>,
    [counts]
  );

  if (rooms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No rooms published yet</CardTitle>
          <CardDescription>
            Once staff publish a room in the admin app, it shows up here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={`inline-block size-2 rounded-full ${
            live ? "bg-state-empty" : "bg-muted-foreground/50"
          }`}
          aria-hidden
        />
        {live ? "Live updates connected" : "Connecting to live updates"}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => {
          const latest = room.zones
            .map((z) => counts[z.id]?.updated_at)
            .filter(Boolean)
            .sort()
            .at(-1);
          const stale = isStale(latest, now);

          return (
            <Card key={room.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate font-serif text-xl font-normal">
                      {room.name}
                    </CardTitle>
                    <CardDescription className="mt-1 text-base text-foreground">
                      {roomSummary(room.zones, countNumbers)}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {room.kind}
                  </Badge>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {stale ? (
                    <>
                      <WifiOff className="size-3.5" aria-hidden />
                      Stale, last update {relativeTime(latest, now)}
                    </>
                  ) : (
                    <>Updated {relativeTime(latest, now)}</>
                  )}
                </p>
              </CardHeader>
              <CardContent>
                {room.zones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No zones drawn yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {room.zones.map((zone) => (
                      <ZoneTile
                        key={zone.id}
                        zone={zone}
                        count={counts[zone.id]?.count}
                        stale={stale}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
