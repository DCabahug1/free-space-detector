"use client";

import { cn } from "@/lib/utils";
import type { Polygon, Zone, ZoneType } from "@/lib/types";
import { displayCount, tileState, type TileState } from "@/lib/occupancy";

// Camera frames are 1280x720. Polygons are stored in this pixel space so
// the camera unit can test foot points against them directly.
export const FRAME_W = 1280;
export const FRAME_H = 720;

// Clicking within this many frame pixels of the first vertex closes the shape.
export const CLOSE_RADIUS = 24;

// Zone types use the state tokens from globals.css: seating leans green,
// open leans orange, legacy line zones stay blue.
export const ZONE_COLORS: Record<ZoneType, string> = {
  seating: "var(--state-empty)",
  line: "var(--state-line)",
  open: "var(--state-shared)",
};

// Zones on the canvas are colored by state, the same as the public map and
// the camera unit's monitor: green vacant, orange occupied, red full.
export const STATE_COLORS: Record<TileState, string> = {
  empty: "var(--state-empty)",
  shared: "var(--state-shared)",
  some: "var(--state-shared)",
  full: "var(--state-full)",
  busy: "var(--state-full)",
  line: "var(--state-line)",
};

// "Table 3 (1/4)" for seating with a capacity, "Lounge (2)" otherwise, and
// just the name until the camera unit has posted a count.
export function zoneLabel(zone: Zone, raw: number | undefined): string {
  if (raw == null) return zone.name;
  const count = displayCount(zone.type, raw, zone.capacity);
  if (zone.type === "seating" && zone.capacity != null) {
    return `${zone.name} (${count}/${zone.capacity})`;
  }
  return `${zone.name} (${count})`;
}

interface ZoneCanvasProps {
  frameSrc: string | null;
  zones: Zone[];
  counts: Record<string, number>;
  selectedId: string | null;
  hiddenId: string | null;
  draft: Polygon;
  drawing: boolean;
  onCanvasClick: (point: [number, number]) => void;
  onZoneClick: (zoneId: string) => void;
}

export function ZoneCanvas({
  frameSrc,
  zones,
  counts,
  selectedId,
  hiddenId,
  draft,
  drawing,
  onCanvasClick,
  onZoneClick,
}: ZoneCanvasProps) {
  function toFrame(event: React.MouseEvent<SVGSVGElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * FRAME_W;
    const y = ((event.clientY - rect.top) / rect.height) * FRAME_H;
    return [clamp(x, 0, FRAME_W), clamp(y, 0, FRAME_H)];
  }

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg border bg-muted select-none",
        drawing && "cursor-crosshair ring-2 ring-primary/40"
      )}
    >
      {frameSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frameSrc}
          alt="Frozen frame from the camera unit"
          className="absolute inset-0 h-full w-full object-fill"
          draggable={false}
        />
      ) : (
        <PlaceholderFrame />
      )}

      <svg
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        className="absolute inset-0 h-full w-full"
        onClick={(e) => onCanvasClick(toFrame(e))}
        role="img"
        aria-label="Zone drawing canvas"
      >
        {zones.map((zone) => {
          if (zone.id === hiddenId) return null;
          const raw = counts[zone.id];
          const color = STATE_COLORS[tileState(zone.type, raw ?? 0, zone.capacity)];
          const selected = zone.id === selectedId;
          const [cx, cy] = centroid(zone.polygon);
          return (
            <g
              key={zone.id}
              className={cn(!drawing && "cursor-pointer")}
              onClick={(e) => {
                if (drawing) return;
                e.stopPropagation();
                onZoneClick(zone.id);
              }}
            >
              <polygon
                points={zone.polygon.map((p) => p.join(",")).join(" ")}
                fill={color}
                fillOpacity={selected ? 0.4 : 0.22}
                stroke={color}
                strokeWidth={selected ? 4 : 2.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={28}
                fontWeight={600}
                fill="white"
                stroke="rgba(0,0,0,0.6)"
                strokeWidth={4}
                paintOrder="stroke"
                style={{ pointerEvents: "none" }}
              >
                {zoneLabel(zone, raw)}
              </text>
            </g>
          );
        })}

        {draft.length > 0 ? (
          <g style={{ pointerEvents: "none" }}>
            {draft.length >= 2 ? (
              <polyline
                points={draft.map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={3}
                strokeDasharray="10 8"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {draft.length >= 3 ? (
              <polygon
                points={draft.map((p) => p.join(",")).join(" ")}
                fill="var(--primary)"
                fillOpacity={0.15}
                stroke="none"
              />
            ) : null}
            {draft.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={i === 0 && draft.length >= 3 ? CLOSE_RADIUS / 2 : 7}
                fill={i === 0 ? "var(--primary)" : "white"}
                stroke="var(--primary)"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function PlaceholderFrame() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-muted"
      style={{
        backgroundImage:
          "linear-gradient(to right, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px)",
        backgroundSize: "6.25% 11.111%",
      }}
    >
      <p className="max-w-xs rounded-md bg-background/80 px-3 py-2 text-center text-xs text-muted-foreground backdrop-blur">
        No frame yet. Upload a photo taken from the camera unit&apos;s angle,
        or draw on the grid. Frame space is 1280 by 720.
      </p>
    </div>
  );
}

export function centroid(polygon: Polygon): [number, number] {
  if (polygon.length === 0) return [0, 0];
  const [sx, sy] = polygon.reduce(
    ([ax, ay], [x, y]) => [ax + x, ay + y],
    [0, 0]
  );
  return [sx / polygon.length, sy / polygon.length];
}

export function distance(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
