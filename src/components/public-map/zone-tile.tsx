"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Zone } from "@/lib/types";
import {
  countText,
  stateColor,
  stateWord,
  tileState,
  type TileState,
} from "@/lib/occupancy";

const FLASH_MS = 300;

const COUNT_SIZE = {
  // xs is the setup page's 320 px preview of the area page.
  xs: "text-[22px] leading-none",
  sm: "text-[34px] leading-none",
  md: "text-[44px] leading-none",
  lg: "text-[76px] leading-none",
} as const;

interface ZoneTileProps {
  zone: Zone;
  count: number | undefined;
  // "4 min" while the camera unit is offline, otherwise null.
  offlineFor?: string | null;
  size?: keyof typeof COUNT_SIZE;
  className?: string;
}

// Page background with a 1 px border, zone name, mono count in the state color, state word,
// and a 6 px bar along the bottom edge. The bar and the numeral are the
// only things that change. On a state change the bar flashes for 300 ms.
export function ZoneTile({ zone, count, offlineFor, size = "sm", className }: ZoneTileProps) {
  const raw = count ?? 0;
  const offline = offlineFor != null;
  const state: TileState = offline ? "unknown" : tileState(zone.type, raw, zone.capacity);
  const color = stateColor(state);
  const word = offline ? `Unknown, ${offlineFor}` : stateWord(state);

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
        "relative flex flex-col overflow-hidden rounded-md border bg-background text-card-foreground",
        size === "xs" ? "gap-1 px-2 pt-2 pb-4" : "gap-2 px-3 pt-3 pb-[22px]",
        className
      )}
      style={{ "--bar": color } as React.CSSProperties}
      aria-label={`${zone.name}: ${word}`}
    >
      <span className={cn("truncate font-medium text-muted-foreground", size === "xs" ? "text-[9px]" : "text-xs")}>
        {zone.name}
      </span>
      <span
        className={cn("font-mono font-bold tabular-nums", COUNT_SIZE[size])}
        style={{ color }}
      >
        {countText(zone, raw)}
      </span>
      <span className={cn("font-semibold", size === "xs" ? "text-[10px]" : "text-sm")}>{word}</span>
      <span
        key={flashKey}
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 bg-[var(--bar)]",
          size === "xs" ? "h-1" : "h-[6px]",
          flashKey > 0 && "animate-[bar-flash_300ms_ease-out]"
        )}
      />
    </div>
  );
}
