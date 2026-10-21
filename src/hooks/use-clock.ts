"use client";

import { useSyncExternalStore } from "react";

// A ticking clock shared by every "3 s ago" caption. The server snapshot is
// 0, and so is the client's hydration render, so the HTML never disagrees
// with the first client paint. Time helpers treat 0 as "not yet".
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let current = 0;

function tick() {
  current = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!timer) {
    timer = setInterval(tick, 1000);
    // First tick right away so the captions fill in after hydration.
    queueMicrotask(tick);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useClock(): number {
  return useSyncExternalStore(subscribe, () => current, () => 0);
}
