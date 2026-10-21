"use client";

import { useEffect, useState } from "react";

export interface LiveFrame {
  url: string;
  unitName: string;
  lastSeen: string | null;
}

export const LIVE_FRAME_INTERVAL_MS = 1000;

// Polls a camera unit's latest frame by bumping a cache-busting query
// string. Stops bumping while frozen so the admin can draw on a still image.
// src stays null until the first frame loads, so a placeholder can show
// when the camera unit has never uploaded anything.
export function useLiveFrame(
  frame: LiveFrame | null,
  frozen: boolean,
  intervalMs: number = LIVE_FRAME_INTERVAL_MS
) {
  const [src, setSrc] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!frame || frozen) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function load() {
      const candidate = `${frame!.url}?t=${Date.now()}`;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setSrc(candidate);
        setAvailable(true);
        setLoadedAt(Date.now());
        timer = setTimeout(load, intervalMs);
      };
      img.onerror = () => {
        if (cancelled) return;
        setAvailable((a) => (a === null ? false : a));
        timer = setTimeout(load, intervalMs);
      };
      img.src = candidate;
    }

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [frame, frozen, intervalMs]);

  return { src, available, loadedAt };
}
