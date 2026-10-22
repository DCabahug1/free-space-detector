"use client";

import { useCallback, useSyncExternalStore } from "react";

// Pinned zone, area and building ids live in localStorage. No login on the
// public map.
const ZONE_KEY = "spot.pins.zones";
const AREA_KEY = "spot.pins";
const BUILDING_KEY = "spot.pins.buildings";
const EVENT = "spot:pins";
const EMPTY: string[] = [];

const cache: Record<string, { raw: string | null | undefined; ids: string[] }> = {};

function read(key: string): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const c = cache[key];
  if (c && raw === c.raw) return c.ids;
  let ids: string[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    ids = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : EMPTY;
  } catch {
    ids = EMPTY;
  }
  cache[key] = { raw, ids };
  return ids;
}

function write(key: string, ids: string[]) {
  const raw = JSON.stringify(ids);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Private mode or blocked storage: the pin lasts for this page view.
  }
  cache[key] = { raw, ids };
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function add(key: string, ids: string[]) {
  const current = read(key);
  const missing = ids.filter((id) => !current.includes(id));
  if (missing.length) write(key, [...current, ...missing]);
}

function remove(key: string, ids: string[]) {
  const current = read(key);
  if (ids.some((id) => current.includes(id))) write(key, current.filter((id) => !ids.includes(id)));
}

// A pinned zone keeps its area pinned, and a pinned area keeps its building
// pinned. Unpinning goes the other way: a building takes its areas and
// their zones with it, an area takes its zones. So the rule always holds.
export function usePins() {
  const zonePins = useSyncExternalStore(subscribe, () => read(ZONE_KEY), () => EMPTY);
  const pins = useSyncExternalStore(subscribe, () => read(AREA_KEY), () => EMPTY);
  const buildingPins = useSyncExternalStore(subscribe, () => read(BUILDING_KEY), () => EMPTY);

  const toggleZone = useCallback((zoneId: string, roomId: string, buildingId: string) => {
    if (read(ZONE_KEY).includes(zoneId)) {
      remove(ZONE_KEY, [zoneId]);
    } else {
      add(ZONE_KEY, [zoneId]);
      add(AREA_KEY, [roomId]);
      add(BUILDING_KEY, [buildingId]);
    }
  }, []);
  const toggle = useCallback((roomId: string, buildingId: string, zoneIds: string[]) => {
    if (read(AREA_KEY).includes(roomId)) {
      remove(AREA_KEY, [roomId]);
      remove(ZONE_KEY, zoneIds);
    } else {
      add(AREA_KEY, [roomId]);
      add(BUILDING_KEY, [buildingId]);
    }
  }, []);
  const toggleBuilding = useCallback((buildingId: string, roomIds: string[], zoneIds: string[]) => {
    if (read(BUILDING_KEY).includes(buildingId)) {
      remove(BUILDING_KEY, [buildingId]);
      remove(AREA_KEY, roomIds);
      remove(ZONE_KEY, zoneIds);
    } else {
      add(BUILDING_KEY, [buildingId]);
    }
  }, []);

  return {
    zonePins,
    pins,
    buildingPins,
    toggleZone,
    toggle,
    toggleBuilding,
    isZonePinned: (id: string) => zonePins.includes(id),
    isPinned: (id: string) => pins.includes(id),
    isBuildingPinned: (id: string) => buildingPins.includes(id),
  };
}
