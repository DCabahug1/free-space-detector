"use client";

import { useSyncExternalStore } from "react";

// True on touch-first devices (phones, tablets), where the primary pointer
// is a finger. False on the server and the hydration render.
const QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

export function useCoarsePointer() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
