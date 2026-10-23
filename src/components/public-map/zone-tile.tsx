"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Zone } from "@/lib/types";
import { availabilityColor, countText, seatsFree, tileState, type TileState } from "@/lib/occupancy";
import { CountPill } from "./count-pill";

const FLASH_MS = 300;

interface ZoneTileProps {
  zone: Zone;
  count: number | undefined;
  // "4 min" while the camera unit is offline, otherwise null.
  offlineFor?: string | null;
  // xs is the setup page's 320 px preview of the area page.
  size?: "xs" | "sm";
  className?: string;
}

// "5 seats free", "Full", or "Unknown, 4 min".
function caption(zone: Zone, raw: number, state: TileState, offlineFor: string | null) {
  if (offlineFor != null) return `Unknown, ${offlineFor}`;
  if (state === "full") return "Full";
  const n = seatsFree(zone, raw);
  return `${n} ${n === 1 ? "seat" : "seats"} free`;
}

// Page background with a 1 px border: zone name, the count in a pill (green
// while empty, amber while shared, red when full, "?" while offline) and the
// seats free. On a state change the pill pulses once for 300 ms.
export function ZoneTile({ zone, count, offlineFor = null, size = "sm", className }: ZoneTileProps) {
  const raw = count ?? 0;
  const offline = offlineFor != null;
  const state: TileState = offline ? "unknown" : tileState(zone.type, raw, zone.capacity);
  const color = availabilityColor(state);
  const text = caption(zone, raw, state, offlineFor);

  const previous = useRef<TileState>(state);
  const [flashKey, setFlashKey] = useState(0);
  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    setFlashKey((k) => k + 1);
    const t = setTimeout(() => setFlashKey(0), FLASH_MS);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div
      className={cn(
        "flex flex-col rounded-md border bg-background text-card-foreground",
        size === "xs" ? "gap-1.5 p-2" : "gap-3 p-3.5",
        className
      )}
      aria-label={`${zone.name}: ${offline ? "?" : countText(zone, raw)}, ${text}`}
    >
      <span
        className={cn("break-words font-medium text-muted-foreground", size === "xs" ? "text-[9px]" : "text-xs")}
      >
        {zone.name}
      </span>
      <CountPill
        key={flashKey}
        color={color}
        size={size === "xs" ? "xs" : "md"}
        className={cn(flashKey > 0 && "animate-[pill-flash_300ms_ease-out]")}
      >
        {offline ? "?" : countText(zone, raw)}
      </CountPill>
      <span className={cn("text-muted-foreground", size === "xs" ? "text-[10px]" : "text-[13px]")}>{text}</span>
    </div>
  );
}
