"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ZoneCount } from "@/lib/types";

// Live zone counts for the admin zone editor, so its canvas shows the same
// state the public map does. Realtime first, a slow poll as a fallback.
const POLL_MS = 45_000;

export function useZoneCounts(
  initial: Record<string, number>
): Record<string, number> {
  // Only what arrived live is kept in state. It is layered over the server
  // snapshot, which refreshes on its own after saves (router.refresh).
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin:zone_counts")
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
          setCounts((prev) => ({ ...prev, [row.zone_id]: row.count }));
        }
      )
      .subscribe();

    async function poll() {
      const { data } = await supabase.from("zone_counts").select("zone_id, count");
      if (data) {
        setCounts(Object.fromEntries(data.map((c) => [c.zone_id, c.count])));
      }
    }
    const timer = setInterval(poll, POLL_MS);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  return { ...initial, ...counts };
}
