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

// The public map's colors: green for an empty spot, amber for one people
// are sharing, red when full. Busy reads red like the other full state.
export function availabilityColor(state: TileState | BuildingState): string {
  switch (state) {
    case "full":
    case "busy":
      return "var(--state-full)";
    case "shared":
    case "some":
      return "var(--state-shared)";
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

function isSpot(zone: Zone): boolean {
  return zone.type === "seating" && zone.capacity != null;
}

// Free spots across zones: tables nobody is at. A 2/3 table and a 0/3
// table make 1 free spot, not 4 free seats.
export function freeSpots(zones: Zone[], counts: Record<string, number | undefined>): number {
  return zones.filter((z) => isSpot(z) && (counts[z.id] ?? 0) <= 0).length;
}

export function totalSpots(zones: Zone[]): number {
  return zones.filter(isSpot).length;
}

export type BuildingState = "empty" | "shared" | "full" | "unknown";

// One state for a building or an area, for its map pin and its free total.
// Offline (every camera unit) is unknown. Half or more of the spots free is
// empty (green), any spot free or any seat open at a shared table is shared
// (amber), none is full (red).
export function buildingState(
  zones: Zone[],
  counts: Record<string, number | undefined>,
  offline: boolean
): BuildingState {
  if (offline) return "unknown";
  const total = totalSpots(zones);
  if (total === 0) return "empty";
  const free = freeSpots(zones, counts);
  if (free * 2 >= total) return "empty";
  if (free > 0) return "shared";
  return zones.some((z) => seatsFree(z, counts[z.id] ?? 0) > 0) ? "shared" : "full";
}

// One line for an area: "3 of 6 spots free".
export function roomSummary(
  zones: Zone[],
  counts: Record<string, number | undefined>
): string {
  const total = totalSpots(zones);
  if (total === 0) return "No spots";
  return `${freeSpots(zones, counts)} of ${total} ${total === 1 ? "spot" : "spots"} free`;
}

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  seating: "Seating",
  line: "Open area",
  open: "Open area",
};
