import seed from "./demo-seed.json";
import type { Building, Polygon, Room, Zone, ZoneCount } from "@/lib/types";

// Portfolio demo: an in-memory stand-in for the Supabase tables, seeded from
// supabase/seed/csun_campus.sql. Every read and write in the app goes here.
// shortcut: state lives per server instance and resets on a cold start (and
// differs between serverless instances); swap back to Supabase for real use.

export interface StoredZone extends Zone {
  created_at: string;
}

export interface StoredUnit {
  id: string;
  name: string;
  pair_code: string | null;
  room_id: string | null;
  last_seen: string | null;
  paused: boolean;
  version: string | null;
  update_requested_at: string | null;
  created_at: string;
}

export interface DemoDb {
  buildings: Building[];
  rooms: Room[];
  zones: StoredZone[];
  units: StoredUnit[];
  counts: Map<string, ZoneCount>;
  lastTick: number;
}

const TICK_MS = 8_000;
// A unit "pulls" a requested update within this long.
const UPDATE_MS = 20_000;
const VERSION = "a1b2c3d";

// Seed ids are deterministic so every server instance agrees on them
// (an /admin/areas/{id} link stays valid). Valid v4 shape for zod's uuid().
let seq = 0;
function seedId() {
  return `00000000-0000-4000-8000-${(++seq).toString(16).padStart(12, "0")}`;
}

function build(): DemoDb {
  const now = new Date().toISOString();
  const db: DemoDb = { buildings: [], rooms: [], zones: [], units: [], counts: new Map(), lastTick: Date.now() };
  for (const b of seed) {
    const building: Building = { id: seedId(), name: b.name, slug: b.slug, lat: b.lat, lng: b.lng };
    db.buildings.push(building);
    b.areas.forEach((a, ri) => {
      const room: Room = {
        id: seedId(),
        building_id: building.id,
        name: a.name,
        slug: a.slug,
        description: a.desc || null,
        published: true,
        sort_order: ri,
      };
      db.rooms.push(room);
      a.zones.forEach((z, zi) => {
        const zone: StoredZone = {
          id: seedId(),
          room_id: room.id,
          name: z.n,
          type: "seating",
          capacity: z.c,
          polygon: z.p as Polygon,
          sort_order: zi,
          created_at: now,
        };
        db.zones.push(zone);
        db.counts.set(zone.id, { zone_id: zone.id, count: Math.min(z.count, z.c), updated_at: now });
      });
      db.units.push({
        id: seedId(),
        name: `Camera unit, ${building.name}, ${room.name}`,
        pair_code: null,
        room_id: room.id,
        last_seen: now,
        paused: false,
        version: VERSION,
        update_requested_at: null,
        created_at: now,
      });
    });
  }
  // One unit waiting to be paired, so the pair flow has something to claim.
  db.units.push({
    id: seedId(),
    name: "Camera unit, spare",
    pair_code: "482913",
    room_id: null,
    last_seen: now,
    paused: false,
    version: VERSION,
    update_requested_at: null,
    created_at: now,
  });
  return db;
}

// Kept on globalThis so dev reloads and every route in the same server
// process share one copy.
const g = globalThis as unknown as { __spotDemoDb?: DemoDb };

// Stands in for the camera units and the old pg_cron mock job: every unit
// heartbeats on each read, and every TICK_MS about 15% of zone counts move
// by one person within capacity.
function tick(db: DemoDb) {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  for (const u of db.units) {
    u.last_seen = iso;
    if (u.update_requested_at && now - Date.parse(u.update_requested_at) > UPDATE_MS) {
      u.update_requested_at = null;
    }
  }
  if (now - db.lastTick < TICK_MS) return;
  db.lastTick = now;
  for (const z of db.zones) {
    const unitInRoom = db.units.some((u) => u.room_id === z.room_id);
    if (!unitInRoom || Math.random() > 0.15) continue;
    const c = db.counts.get(z.id) ?? { zone_id: z.id, count: 0, updated_at: iso };
    const cap = z.capacity ?? 1;
    const next = Math.max(0, Math.min(cap, c.count + (Math.random() < 0.5 ? -1 : 1)));
    db.counts.set(z.id, { zone_id: z.id, count: next, updated_at: iso });
  }
}

// The live database. Call after connection() in server code so it is read
// per request, not frozen into a prerender.
export function demoDb(): DemoDb {
  g.__spotDemoDb ??= build();
  tick(g.__spotDemoDb);
  return g.__spotDemoDb;
}

export function newId() {
  return crypto.randomUUID();
}

export function bySortThenName<T extends { sort_order: number; name: string }>(a: T, b: T) {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}
