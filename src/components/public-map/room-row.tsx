import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PublicRoom } from "@/lib/types";
import { roomPath } from "@/lib/types";
import { freeSeats, roomSummary, stateColor, tileState } from "@/lib/occupancy";

interface RoomRowProps {
  room: PublicRoom;
  counts: Record<string, number | undefined>;
  // "4 min" while the camera unit is offline, otherwise null.
  offlineFor: string | null;
  className?: string;
}

// One directory row: name, summary caption, free count, and a 4 px strip
// with one segment per zone in its state color. The whole row links to the
// room page. Hairlines come from the parent (divide-y).
export function RoomRow({ room, counts, offlineFor, className }: RoomRowProps) {
  const offline = offlineFor != null;
  const free = freeSeats(room.zones, counts);
  const freeColor = offline
    ? "var(--state-unknown)"
    : free > 0
      ? "var(--state-empty)"
      : "var(--state-full)";

  return (
    <Link
      href={roomPath(room)}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-4 py-3 hover:bg-card",
        className
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[15px] font-medium">{room.name}</div>
        <div className={cn("text-[13px]", offline ? "text-state-full" : "text-muted-foreground")}>
          {offline ? `Camera unit offline, ${offlineFor}` : roomSummary(room.zones, counts)}
        </div>
      </div>
      <div className="flex items-baseline gap-1 self-center">
        <span className="font-mono text-xl font-bold tabular-nums" style={{ color: freeColor }}>
          {offline ? "?" : free}
        </span>
        <span className="text-[13px] text-muted-foreground">{offline ? "unknown" : "free"}</span>
      </div>
      {room.zones.length > 0 ? (
        <div className="col-span-2 flex h-1 gap-px" aria-hidden>
          {room.zones.map((z) => (
            <span
              key={z.id}
              className="flex-1"
              style={{
                backgroundColor: offline
                  ? "var(--state-unknown)"
                  : stateColor(tileState(z.type, counts[z.id] ?? 0, z.capacity)),
              }}
            />
          ))}
        </div>
      ) : null}
    </Link>
  );
}
