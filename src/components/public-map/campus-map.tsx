"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { APIProvider, AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { useTheme } from "next-themes";
import type { LatLng } from "@/lib/geo";
import type { BuildingState } from "@/lib/occupancy";
import { useMapPref } from "@/lib/prefs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: BuildingState;
  free: number;
  offline: boolean;
}

interface CampusMapProps {
  pins: MapPin[];
  // The person, while Nearest is on.
  position: LatLng | null;
  onSelect: (buildingId: string) => void;
}

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// AdvancedMarker needs a map id. Google's demo id works without setup.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const noop = () => () => {};

const PIN_BG: Record<BuildingState, string> = {
  empty: "bg-state-empty",
  shared: "bg-state-shared",
  full: "bg-state-full",
  unknown: "bg-state-unknown",
};

// One pin per building that has a location, in the building's state color
// with its free total inside. No Google controls, one finger scrolls the
// page. Renders nothing without a key, after a load failure, or with no
// located building, so the page never shows a broken map.
export function CampusMap({ pins, position, onSelect }: CampusMapProps) {
  const [pref, setPref] = useMapPref();
  const [failed, setFailed] = useState(false);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { resolvedTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";

  // An invalid or restricted key fails after the script loads, through
  // this global rather than the provider's onError.
  useEffect(() => {
    const w = window as Window & { gm_authFailure?: () => void };
    w.gm_authFailure = () => setFailed(true);
    return () => {
      delete w.gm_authFailure;
    };
  }, []);

  if (!KEY || failed || pins.length === 0) return null;
  const shown = pref === "shown";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-[13px] text-muted-foreground"
          onClick={() => setPref(shown ? "hidden" : "shown")}
        >
          {shown ? "Hide map" : "Show map"}
        </Button>
      </div>
      {shown ? (
        <div className="h-[200px] w-full overflow-hidden rounded-lg border border-building-border bg-muted md:h-[320px]">
          <APIProvider apiKey={KEY} onError={() => setFailed(true)}>
            <Map
              key={dark ? "dark" : "light"}
              mapId={MAP_ID}
              colorScheme={dark ? "DARK" : "LIGHT"}
              defaultBounds={boundsOf(pins, position)}
              disableDefaultUI
              gestureHandling="cooperative"
              clickableIcons={false}
              className="h-full w-full"
            >
              <FitPins pins={pins} position={position} />
              {pins.map((p) => (
                <AdvancedMarker
                  key={p.id}
                  position={{ lat: p.lat, lng: p.lng }}
                  title={p.name}
                  onClick={() => onSelect(p.id)}
                >
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 border-background font-mono text-[12px] font-bold text-white",
                      PIN_BG[p.state]
                    )}
                  >
                    {p.offline ? "?" : p.free}
                  </div>
                </AdvancedMarker>
              ))}
              {position ? (
                <AdvancedMarker position={position} title="You">
                  <div className="size-3 rounded-full border-2 border-white bg-primary" />
                </AdvancedMarker>
              ) : null}
            </Map>
          </APIProvider>
        </div>
      ) : null}
    </div>
  );
}

// Bounds around every pin and the person, never narrower than about
// 400 m so a single building does not zoom to the rooftop.
function boundsOf(pins: MapPin[], position: LatLng | null): google.maps.LatLngBoundsLiteral {
  const points: LatLng[] = [...pins, ...(position ? [position] : [])];
  let north = -90, south = 90, east = -180, west = 180;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  const minSpan = 0.004;
  if (north - south < minSpan) {
    const mid = (north + south) / 2;
    north = mid + minSpan / 2;
    south = mid - minSpan / 2;
  }
  if (east - west < minSpan) {
    const mid = (east + west) / 2;
    east = mid + minSpan / 2;
    west = mid - minSpan / 2;
  }
  return { north, south, east, west };
}

// Refits only when the set of pins changes or the person's dot appears,
// never on a count change, so the map holds still while numbers move.
function FitPins({ pins, position }: { pins: MapPin[]; position: LatLng | null }) {
  const map = useMap();
  const ids = pins.map((p) => p.id).join(",");
  const located = position != null;
  useEffect(() => {
    if (!map) return;
    map.fitBounds(boundsOf(pins, position), 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ids, located]);
  return null;
}
