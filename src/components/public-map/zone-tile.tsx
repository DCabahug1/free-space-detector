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

// Card background, zone name, mono count in the state color, state word,
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
        "relative flex flex-col gap-2 overflow-hidden bg-card px-4 pt-3 pb-[22px] text-card-foreground shadow-surface",
        className
      )}
      style={{ "--bar": color } as React.CSSProperties}
      aria-label={`${zone.name}: ${word}`}
    >
      <span className="truncate text-xs text-muted-foreground">{zone.name}</span>
      <span
        className={cn("font-mono font-bold tabular-nums", COUNT_SIZE[size])}
        style={{ color }}
      >
        {countText(zone, raw)}
      </span>
      <span className="text-sm font-semibold">{word}</span>
      <span
        key={flashKey}
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-[6px] bg-[var(--bar)]",
          flashKey > 0 && "animate-[bar-flash_300ms_ease-out]"
        )}
      />
    </div>
  );
}
