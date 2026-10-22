"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type GeoStatus = "idle" | "locating" | "on" | "denied" | "unavailable";

// The person's position for the Nearest sort and the dot on the campus
// map. Nothing is requested until request() runs, so the page never
// prompts on load. After the first fix the position follows them.
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [position, setPosition] = useState<LatLng | null>(null);
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current != null) {
      try {
        navigator.geolocation.clearWatch(watchId.current);
      } catch {
        // Nothing to clear.
      }
      watchId.current = null;
    }
    setStatus("idle");
    setPosition(null);
  }, []);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    if (watchId.current != null) return;
    setStatus("locating");
    const onFix = (p: GeolocationPosition) => {
      setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
      setStatus("on");
    };
    const onError = (e: GeolocationPositionError) => {
      setStatus(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable");
      setPosition(null);
      watchId.current = null;
    };
    try {
      navigator.geolocation.getCurrentPosition(onFix, onError, { maximumAge: 60_000, timeout: 10_000 });
      watchId.current = navigator.geolocation.watchPosition(onFix, () => {}, { maximumAge: 15_000 });
    } catch {
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => () => {
    if (watchId.current != null) {
      try {
        navigator.geolocation.clearWatch(watchId.current);
      } catch {
        // Nothing to clear.
      }
    }
  }, []);

  return { status, position, request, stop };
}
