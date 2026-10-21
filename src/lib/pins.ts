"use client";

import { useCallback, useSyncExternalStore } from "react";

// Pinned area ids and pinned building ids live in localStorage. No login
// on the public map.
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

export function usePins() {
  const pins = useSyncExternalStore(subscribe, () => read(AREA_KEY), () => EMPTY);
  const buildingPins = useSyncExternalStore(subscribe, () => read(BUILDING_KEY), () => EMPTY);

  // A pinned area keeps its building pinned. Unpinning a building unpins
  // its areas, so the rule always holds.
  const toggle = useCallback((roomId: string, buildingId: string) => {
    if (read(AREA_KEY).includes(roomId)) {
      remove(AREA_KEY, [roomId]);
    } else {
      add(AREA_KEY, [roomId]);
      add(BUILDING_KEY, [buildingId]);
    }
  }, []);
  const toggleBuilding = useCallback((buildingId: string, roomIds: string[]) => {
    if (read(BUILDING_KEY).includes(buildingId)) {
      remove(BUILDING_KEY, [buildingId]);
      remove(AREA_KEY, roomIds);
    } else {
      add(BUILDING_KEY, [buildingId]);
    }
  }, []);

  return {
    pins,
    buildingPins,
    toggle,
    toggleBuilding,
    isPinned: (id: string) => pins.includes(id),
    isBuildingPinned: (id: string) => buildingPins.includes(id),
  };
}
