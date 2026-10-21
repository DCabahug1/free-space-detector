"use client";

import { cn } from "@/lib/utils";
import type { Polygon, Zone } from "@/lib/types";
import { countText, stateColor, tileState } from "@/lib/occupancy";

// Camera frames are 1280x720. Polygons are stored in this pixel space so
// the camera unit can test foot points against them directly.
export const FRAME_W = 1280;
export const FRAME_H = 720;

// Clicking within this many frame pixels of the first vertex closes the shape.
export const CLOSE_RADIUS = 24;

// "Table 2 2/4", or just the name until the camera unit has posted a count.
export function zoneLabel(zone: Zone, raw: number | undefined): string {
  if (raw == null) return zone.name;
  return `${zone.name} ${countText(zone, raw)}`;
}

interface ZoneCanvasProps {
  frameSrc: string | null;
  zones: Zone[];
  counts: Record<string, number | undefined>;
  selectedId: string | null;
  draft: Polygon;
  drawing: boolean;
  onCanvasClick: (point: [number, number]) => void;
  onZoneClick: (zoneId: string) => void;
}

// 16:9, the real frame. Saved zones as polygons filled with their state
// color at 22 %, 3 px stroke. The selected zone gets a 6 px stroke and 16 px
// square white vertex handles. Labels sit at the centroid in a dark pill.
export function ZoneCanvas({
  frameSrc,
  zones,
  counts,
  selectedId,
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
        "relative aspect-video w-full overflow-hidden bg-muted select-none",
        drawing && "cursor-crosshair"
      )}
    >
      {frameSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frameSrc}
          alt="Frame from the camera unit"
          className="absolute inset-0 h-full w-full object-fill"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="max-w-xs text-center text-[13px] text-muted-foreground">
            No frame yet. Upload a photo from the camera unit&apos;s angle, or wait for the live frame.
          </p>
        </div>
      )}

      <svg
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        className="absolute inset-0 h-full w-full"
        onClick={(e) => onCanvasClick(toFrame(e))}
        role="img"
        aria-label="Zone drawing canvas"
      >
        {zones.map((zone) => {
          if (zone.polygon.length < 3) return null;
          const raw = counts[zone.id];
          const color = stateColor(tileState(zone.type, raw ?? 0, zone.capacity));
          const selected = zone.id === selectedId;
          const points = zone.polygon.map((p) => p.join(",")).join(" ");
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
                points={points}
                fill={color}
                fillOpacity={0.22}
                stroke={color}
                strokeWidth={selected ? 6 : 3}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {selected
                ? zone.polygon.map(([x, y], i) => (
                    <rect
                      key={i}
                      x={x - 8}
                      y={y - 8}
                      width={16}
                      height={16}
                      fill="white"
                      stroke={color}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))
                : null}
            </g>
          );
        })}

        {zones.map((zone) => {
          if (zone.polygon.length < 3) return null;
          const [cx, cy] = centroid(zone.polygon);
          return <Label key={zone.id} x={cx} y={cy} text={zoneLabel(zone, counts[zone.id])} />;
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
                fillOpacity={0.12}
                stroke="none"
              />
            ) : null}
            {draft.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={7}
                fill={i === 0 ? "var(--primary)" : "var(--background)"}
                stroke="var(--primary)"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <circle
              cx={draft[0][0]}
              cy={draft[0][1]}
              r={CLOSE_RADIUS}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

// Dark pill with mono white text, centered on (x, y).
function Label({ x, y, text }: { x: number; y: number; text: string }) {
  const fontSize = 22;
  const padX = 12;
  const width = text.length * fontSize * 0.62 + padX * 2;
  const height = fontSize + 14;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        fill="rgba(20, 18, 15, 0.82)"
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontFamily="var(--font-mono)"
        fontWeight={700}
        fill="white"
      >
        {text}
      </text>
    </g>
  );
}

export function centroid(polygon: Polygon): [number, number] {
  if (polygon.length === 0) return [0, 0];
  const [sx, sy] = polygon.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
  return [sx / polygon.length, sy / polygon.length];
}

export function distance(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
