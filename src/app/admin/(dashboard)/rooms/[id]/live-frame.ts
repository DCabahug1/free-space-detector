"use client";

import { useEffect, useState } from "react";

export interface LiveFrame {
  url: string;
  unitName: string;
  lastSeen: string | null;
}

export const LIVE_FRAME_INTERVAL_MS = 1000;

// Polls the camera unit's latest frame by bumping a cache-busting query
// string. Stops bumping while frozen so the admin can draw on a still image.
// Returns null until the first frame loads, so the placeholder shows when
// the camera unit has never uploaded anything.
export function useLiveFrame(frame: LiveFrame | null, frozen: boolean) {
  const [src, setSrc] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!frame) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function load() {
      const candidate = `${frame!.url}?t=${Date.now()}`;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setSrc(candidate);
        setAvailable(true);
        schedule();
      };
      img.onerror = () => {
        if (cancelled) return;
        setAvailable((a) => (a === null ? false : a));
        schedule();
      };
      img.src = candidate;
    }

    function schedule() {
      timer = setTimeout(load, LIVE_FRAME_INTERVAL_MS);
    }

    if (frozen) {
      // Keep whatever is on screen. Resume polling once unfrozen.
      return;
    }
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [frame, frozen]);

  return { src, available };
}
