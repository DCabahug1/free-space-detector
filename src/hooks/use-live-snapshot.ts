"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useClock } from "@/hooks/use-clock";
import type { PublicRoom, ZoneCount } from "@/lib/types";
import { isOffline } from "@/lib/occupancy";

// Live counts and heartbeats for the public pages. The demo build has no
// Realtime: it polls /api/live, which reads the in-memory demo store.
const POLL_MS = 5_000;

export type Connection = "connecting" | "live" | "reconnecting";

export interface LiveSnapshot {
  counts: Record<string, ZoneCount>;
  countNumbers: Record<string, number | undefined>;
  // Latest heartbeat per room, from camera_units.last_seen or any of the
  // room's zone_counts.updated_at, whichever is newer.
  heartbeat: (room: PublicRoom) => string | null;
  roomOffline: (room: PublicRoom) => boolean;
  // Every camera unit in the room has paused sharing.
  roomPaused: (room: PublicRoom) => boolean;
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
  const [paused, setPaused] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rooms.flatMap((r) => r.units.map((u) => [u.id, u.paused])))
  );
  const now = useClock();
  const [connection, setConnection] = useState<Connection>("connecting");
  const wasLive = useRef(false);

  const unitKey = rooms.flatMap((r) => r.units.map((u) => u.id)).join(",");
  const zoneKey = rooms.flatMap((r) => r.zones.map((z) => z.id)).join(",");

  useEffect(() => {
    const unitIds = new Set(unitKey ? unitKey.split(",") : []);
    const zoneIds = new Set(zoneKey ? zoneKey.split(",") : []);
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          counts: ZoneCount[];
          units: { id: string; last_seen: string | null; paused: boolean }[];
        };
        if (cancelled) return;
        const rows = data.counts.filter((c) => zoneIds.has(c.zone_id));
        const units = data.units.filter((u) => unitIds.has(u.id));
        setCounts((prev) => ({ ...prev, ...Object.fromEntries(rows.map((c) => [c.zone_id, c])) }));
        setLastSeen((prev) => ({ ...prev, ...Object.fromEntries(units.map((u) => [u.id, u.last_seen])) }));
        setPaused((prev) => ({ ...prev, ...Object.fromEntries(units.map((u) => [u.id, u.paused])) }));
        wasLive.current = true;
        setConnection("live");
      } catch {
        if (!cancelled && wasLive.current) setConnection("reconnecting");
      }
    }
    // Right away as well: a zone drawn a moment ago, or a page opened from
    // a stale snapshot, gets current counts without waiting a full interval.
    void poll();
    const pollTimer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollTimer);
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
    roomPaused: (room) => room.units.length > 0 && room.units.every((u) => paused[u.id] ?? u.paused),
    latestUpdate,
    connection,
    now,
  };
}
