"use client";

import { useEffect, useState } from "react";

// A ticking Date.now() for "3 s ago" captions. Starts at the server-rendered
// moment so the first client paint matches the HTML.
export function useClock(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
