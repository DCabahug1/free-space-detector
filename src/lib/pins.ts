"use client";

import { useCallback, useSyncExternalStore } from "react";

// Pinned room ids live in localStorage. No login on the public map.
const KEY = "spot.pins";
const EVENT = "spot:pins";
const EMPTY: string[] = [];

let cached: string[] = EMPTY;
let cachedRaw: string | null | undefined;

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function usePins() {
  const pins = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((roomId: string) => {
    const current = read();
    const next = current.includes(roomId)
      ? current.filter((id) => id !== roomId)
      : [...current, roomId];
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private mode or blocked storage: the pin lasts for this page view.
      cachedRaw = JSON.stringify(next);
      cached = next;
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { pins, toggle, isPinned: (id: string) => pins.includes(id) };
}
