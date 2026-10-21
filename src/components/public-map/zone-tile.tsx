import { Armchair, Footprints, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Zone } from "@/lib/types";
import { displayCount, tileLabel, tileState, type TileState } from "@/lib/occupancy";

const STATE_STYLES: Record<TileState, string> = {
  empty: "border-state-empty/40 bg-state-empty/10",
  shared: "border-state-shared/50 bg-state-shared/15",
  full: "border-state-full/50 bg-state-full/15",
  some: "border-state-shared/50 bg-state-shared/15",
  busy: "border-state-full/50 bg-state-full/15",
  line: "border-state-line/40 bg-state-line/10",
};

const DOT_STYLES: Record<TileState, string> = {
  empty: "bg-state-empty",
  shared: "bg-state-shared",
  full: "bg-state-full",
  some: "bg-state-shared",
  busy: "bg-state-full",
  line: "bg-state-line",
};

interface ZoneTileProps {
  zone: Zone;
  count: number | undefined;
  stale?: boolean;
  compact?: boolean;
}

export function ZoneTile({ zone, count, stale, compact }: ZoneTileProps) {
  const raw = count ?? 0;
  const state = tileState(zone.type, raw, zone.capacity);
  const label = tileLabel(state, raw);
  const n = displayCount(zone.type, raw, zone.capacity);
  const Icon =
    zone.type === "seating" ? Armchair : zone.type === "line" ? Footprints : Users;

  let detail: string;
  if (zone.type === "seating") {
    detail =
      zone.capacity != null ? `${n} of ${zone.capacity} seats taken` : `${n} here`;
  } else if (zone.type === "line") {
    detail = n === 1 ? "1 person in line" : `${n} people in line`;
  } else {
    detail = n === 1 ? "1 person" : `${n} people`;
  }

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between rounded-lg border text-card-foreground shadow-xs transition-colors",
        compact ? "min-h-20 p-3" : "min-h-28 p-4",
        STATE_STYLES[state],
        stale && "opacity-60 saturate-50"
      )}
      aria-label={`${zone.name}: ${label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-medium">{zone.name}</span>
        <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
      </div>
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block size-2.5 rounded-full",
              DOT_STYLES[state],
              !stale && state !== "empty" && "animate-pulse"
            )}
            aria-hidden
          />
          <span className={cn("font-semibold", compact ? "text-base" : "text-lg")}>
            {label}
          </span>
        </div>
        <p className="mt-0.5 text-xs opacity-80">
          {detail}
          {zone.type === "line" && n > 0 ? " (estimate)" : ""}
        </p>
      </div>
    </div>
  );
}
