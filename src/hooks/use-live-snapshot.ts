"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PublicRoom, ZoneCount } from "@/lib/types";
import { isOffline } from "@/lib/occupancy";

// Live counts and heartbeats for the public pages. Realtime on zone_counts
// first (every ingest post, heartbeat included, bumps updated_at), a poll of
// zone_counts and camera_units.last_seen as the fallback for networks that
// block the websocket.
const POLL_MS = 15_000;
const CLOCK_MS = 1_000;

export type Connection = "connecting" | "live" | "reconnecting";

export interface LiveSnapshot {
  counts: Record<string, ZoneCount>;
  countNumbers: Record<string, number | undefined>;
  // Latest heartbeat per room, from camera_units.last_seen or any of the
  // room's zone_counts.updated_at, whichever is newer.
  heartbeat: (room: PublicRoom) => string | null;
  roomOffline: (room: PublicRoom) => boolean;
  latestUpdate: string | null;
  connection: Connection;
  now: number;
}

export function useLiveSnapshot(rooms: PublicRoom[], initialCounts: ZoneCount[]): LiveSnapshot {
  const [counts, setCounts] = useState<Record<string, ZoneCount>>(() =>
    Object.fromEntries(initialCounts.map((c) => [c.zone_id, c]))
  );
  const [lastSeen, setLastSeen] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(rooms.flatMap((r) => r.units.map((u) => [u.id, u.last_seen])))
  );
  const [now, setNow] = useState(() => Date.now());
  const [connection, setConnection] = useState<Connection>("connecting");
  const wasLive = useRef(false);

  const unitKey = rooms.flatMap((r) => r.units.map((u) => u.id)).join(",");
  const zoneKey = rooms.flatMap((r) => r.zones.map((z) => z.id)).join(",");

  useEffect(() => {
    const unitIds = unitKey ? unitKey.split(",") : [];
    const zoneIds = zoneKey ? zoneKey.split(",") : [];
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
        if (status === "SUBSCRIBED") {
          wasLive.current = true;
          setConnection("live");
        } else if (wasLive.current) {
          setConnection("reconnecting");
        }
      });

    async function poll() {
      if (zoneIds.length > 0) {
        const { data } = await supabase
          .from("zone_counts")
          .select("zone_id, count, updated_at")
          .in("zone_id", zoneIds);
        if (data) {
          const rows = data as ZoneCount[];
          setCounts((prev) => ({ ...prev, ...Object.fromEntries(rows.map((c) => [c.zone_id, c])) }));
        }
      }
      if (unitIds.length > 0) {
        const { data } = await supabase.from("camera_units").select("id, last_seen").in("id", unitIds);
        if (data) {
          const rows = data as { id: string; last_seen: string | null }[];
          setLastSeen((prev) => ({ ...prev, ...Object.fromEntries(rows.map((u) => [u.id, u.last_seen])) }));
        }
      }
    }
    const pollTimer = setInterval(poll, POLL_MS);
    const clockTimer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => {
      clearInterval(pollTimer);
      clearInterval(clockTimer);
      supabase.removeChannel(channel);
    };
  }, [zoneKey, unitKey]);

  const countNumbers = useMemo(
    () =>
      Object.fromEntries(Object.values(counts).map((c) => [c.zone_id, c.count])) as Record<
        string,
        number | undefined
      >,
    [counts]
  );

  const latestUpdate = useMemo(() => {
    const all = Object.values(counts).map((c) => c.updated_at);
    return all.length ? all.sort().at(-1)! : null;
  }, [counts]);

  function heartbeat(room: PublicRoom): string | null {
    const stamps = [
      ...room.units.map((u) => lastSeen[u.id] ?? u.last_seen),
      ...room.zones.map((z) => counts[z.id]?.updated_at),
    ].filter((s): s is string => Boolean(s));
    return stamps.length ? stamps.sort().at(-1)! : null;
  }

  return {
    counts,
    countNumbers,
    heartbeat,
    roomOffline: (room) => isOffline(heartbeat(room), now),
    latestUpdate,
    connection,
    now,
  };
}
