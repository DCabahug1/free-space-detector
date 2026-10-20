import type { Zone, ZoneType } from "@/lib/types";

// Tile state rules shared by the public map and the admin preview.
//   seating: empty (0) / shared (0 < count < capacity) / full (count >= capacity)
//   line:    count plus a wait estimate
//   open:    empty (0) / some (1 to 3) / busy (4+)

export type TileState = "empty" | "shared" | "full" | "some" | "busy" | "line";

export const SECONDS_PER_PERSON = 45;
export const STALE_AFTER_MS = 2 * 60 * 1000;

export function tileState(
  type: ZoneType,
  count: number,
  capacity: number | null
): TileState {
  if (type === "line") return "line";
  if (count <= 0) return "empty";
  if (type === "seating") {
    if (capacity != null && count >= capacity) return "full";
    return "shared";
  }
  return count >= 4 ? "busy" : "some";
}

export function tileLabel(state: TileState, count: number): string {
  switch (state) {
    case "empty":
      return "Empty";
    case "shared":
      return "Shared";
    case "full":
      return "Full";
    case "some":
      return "Some people";
    case "busy":
      return "Busy";
    case "line":
      return count === 0 ? "No line" : waitEstimate(count);
  }
}

export function waitEstimate(count: number): string {
  if (count <= 0) return "No wait";
  const seconds = count * SECONDS_PER_PERSON;
  if (seconds < 60) return `~${seconds} s wait`;
  const minutes = Math.round(seconds / 60);
  return `~${minutes} min wait`;
}

export function isStale(updatedAt: string | null | undefined, now: number) {
  if (!updatedAt) return true;
  return now - new Date(updatedAt).getTime() > STALE_AFTER_MS;
}

export function relativeTime(iso: string | null | undefined, now: number) {
  if (!iso) return "never";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.round(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

// Short summary for a room card, for example "2 of 3 spots free".
export function roomSummary(
  zones: Zone[],
  counts: Record<string, number | undefined>
): string {
  const seating = zones.filter((z) => z.type === "seating");
  if (seating.length > 0) {
    const free = seating.filter((z) => (counts[z.id] ?? 0) === 0).length;
    const noun = seating.length === 1 ? "spot" : "spots";
    return `${free} of ${seating.length} ${noun} free`;
  }
  const line = zones.find((z) => z.type === "line");
  if (line) return waitEstimate(counts[line.id] ?? 0);
  const total = zones.reduce((sum, z) => sum + (counts[z.id] ?? 0), 0);
  return total === 0 ? "Empty" : `${total} people here`;
}

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  seating: "Seating",
  line: "Line",
  open: "Open area",
};
