"use client";

import { useSyncExternalStore } from "react";

// Small per-browser choices on the public map, kept in localStorage the
// same way pins are: the sort (free tables or nearest) and whether the
// campus map is shown. Server and hydration render the default.

const EVENT = "spot:prefs";
const cache: Record<string, string | null> = {};

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return cache[key] ?? null;
  }
}

function write(key: string, value: string) {
  cache[key] = value;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page view.
  }
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

function usePref<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const value = allowed.includes(raw as T) ? (raw as T) : fallback;
  return [value, (v: T) => write(key, v)];
}

export type SortPref = "free" | "nearest";
export function useSortPref() {
  return usePref<SortPref>("spot.sort", "free", ["free", "nearest"]);
}

export type MapPref = "shown" | "hidden";
export function useMapPref() {
  return usePref<MapPref>("spot.map", "shown", ["shown", "hidden"]);
}
