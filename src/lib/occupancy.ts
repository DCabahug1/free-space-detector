import type { Zone, ZoneType } from "@/lib/types";

// Tile state rules shared by the public map, the admin canvas, and the
// camera unit monitor (mirrored in camera-unit/status.py).
//   seating: Empty (0) / Shared (0 < count < capacity) / Full (count >= capacity)
//   open:    Empty (0) / Some people (1 to 3) / Busy (4+)
//   line:    deprecated, counted like an open zone
//   unknown: the camera unit has not posted for OFFLINE_AFTER_MS

export type TileState = "empty" | "shared" | "full" | "some" | "busy" | "unknown";

export const OFFLINE_AFTER_MS = 60 * 1000;
export const BUSY_FROM = 4;

export function tileState(
  type: ZoneType,
  count: number,
  capacity: number | null
): TileState {
  if (count <= 0) return "empty";
  if (type === "seating") {
    if (capacity != null && count >= capacity) return "full";
    return "shared";
  }
  return count >= BUSY_FROM ? "busy" : "some";
}

// Count as shown to people. A seating zone never displays more than its
// capacity (two people squeezed at a one seat table reads 1/1, not 2/1).
// The raw count is still stored and still drives the tile state.
export function displayCount(
  type: ZoneType,
  count: number,
  capacity: number | null
): number {
  if (type === "seating" && capacity != null && capacity > 0) {
    return Math.min(count, capacity);
  }
  return count;
}

// "2/4" for seating with a capacity, "2" otherwise.
export function countText(zone: Zone, count: number): string {
  const n = displayCount(zone.type, count, zone.capacity);
  if (zone.type === "seating" && zone.capacity != null) {
    return `${n}/${zone.capacity}`;
  }
  return String(n);
}

export function stateWord(state: TileState): string {
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
    case "unknown":
      return "Unknown";
  }
}

// CSS color for a state, from the tokens in globals.css.
export function stateColor(state: TileState): string {
  switch (state) {
    case "empty":
      return "var(--state-empty)";
    case "shared":
    case "some":
      return "var(--state-shared)";
    case "full":
    case "busy":
      return "var(--state-full)";
    case "unknown":
      return "var(--state-unknown)";
  }
}

// now === 0 means the client clock has not started (server render and the
// hydration pass), so nothing is reported offline or timed yet.
export function isOffline(lastSeen: string | null | undefined, now: number) {
  if (now === 0) return false;
  if (!lastSeen) return true;
  return now - new Date(lastSeen).getTime() > OFFLINE_AFTER_MS;
}

// "8 s", "4 min", "2 h", "3 d".
export function durationText(since: string | null | undefined, now: number) {
  if (!since || now === 0) return "";
  const s = Math.max(0, Math.round((now - new Date(since).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

// "just now" for the first minute, then "4 min ago", "2 h ago", or "never".
// Captions move once a minute, not every second.
export function relativeTime(iso: string | null | undefined, now: number) {
  if (!iso) return "never";
  if (now === 0) return "";
  const s = (now - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${durationText(iso, now)} ago`;
}

// "4:12 PM"
export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// The public map speaks in two colors: green while a seat is free, red when
// there is none. Shared reads green there (a seat is still open); the admin
// canvas and the camera unit monitor keep the three-color stateColor.
export function availabilityColor(state: TileState): string {
  switch (state) {
    case "full":
    case "busy":
      return "var(--state-full)";
    case "unknown":
      return "var(--state-unknown)";
    default:
      return "var(--state-empty)";
  }
}

// Open seats in one zone: capacity minus the people at it, never below 0.
export function seatsFree(zone: Zone, count: number): number {
  if (zone.type !== "seating" || zone.capacity == null) return 0;
  return Math.max(0, zone.capacity - count);
}

// Open seats across zones. A table with one person at a six seat table
// still has five seats free.
export function freeSeats(zones: Zone[], counts: Record<string, number | undefined>): number {
  return zones.reduce((sum, z) => sum + seatsFree(z, counts[z.id] ?? 0), 0);
}

export function totalSeats(zones: Zone[]): number {
  return zones.reduce((sum, z) => sum + (z.type === "seating" && z.capacity != null ? z.capacity : 0), 0);
}

export type BuildingState = "empty" | "full" | "unknown";

// One state for a whole building, for its map pin and its free total.
// Offline (every camera unit) is unknown, any free seat is empty (green),
// none is full (red).
export function buildingState(
  zones: Zone[],
  counts: Record<string, number | undefined>,
  offline: boolean
): BuildingState {
  if (offline) return "unknown";
  if (totalSeats(zones) === 0) return "empty";
  return freeSeats(zones, counts) > 0 ? "empty" : "full";
}

// One line for an area: "14 of 24 seats free".
export function roomSummary(
  zones: Zone[],
  counts: Record<string, number | undefined>
): string {
  const total = totalSeats(zones);
  if (total === 0) return "No seats";
  return `${freeSeats(zones, counts)} of ${total} ${total === 1 ? "seat" : "seats"} free`;
}

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  seating: "Seating",
  line: "Open area",
  open: "Open area",
};
