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

function toggleIn(key: string, id: string) {
  const current = read(key);
  write(key, current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
}

export function usePins() {
  const pins = useSyncExternalStore(subscribe, () => read(AREA_KEY), () => EMPTY);
  const buildingPins = useSyncExternalStore(subscribe, () => read(BUILDING_KEY), () => EMPTY);

  const toggle = useCallback((roomId: string) => toggleIn(AREA_KEY, roomId), []);
  const toggleBuilding = useCallback((buildingId: string) => toggleIn(BUILDING_KEY, buildingId), []);

  return {
    pins,
    buildingPins,
    toggle,
    toggleBuilding,
    isPinned: (id: string) => pins.includes(id),
    isBuildingPinned: (id: string) => buildingPins.includes(id),
  };
}
