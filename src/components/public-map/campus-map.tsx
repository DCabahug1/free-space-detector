"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  APIProvider,
  ControlPosition,
  Map,
  MapControl,
  Marker,
  RenderingType,
  useMap,
} from "@vis.gl/react-google-maps";
import { LocateFixed } from "lucide-react";
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
  // False while the search or the Free now filter leaves this building out.
  // The pin is hidden, the map stays.
  shown: boolean;
}

interface CampusMapProps {
  pins: MapPin[];
  // The person, once the browser has a fix.
  position: LatLng | null;
  // Asks for the position again, from the locate control.
  onRequestPosition: () => void;
  onSelect: (buildingId: string) => void;
}

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const noop = () => () => {};
const PERSON_ZOOM = 16;

// Google's own points of interest and transit icons stay off, so the only
// markers on the map are Spot's. Styles need a raster map, and the classic
// marker needs no map id.
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

const STATE_TOKEN: Record<BuildingState, string> = {
  empty: "--state-empty",
  shared: "--state-shared",
  full: "--state-full",
  unknown: "--state-unknown",
};

// One pin per building that has a location, in the building's state color
// with its free total inside and a primary outline. The person is a primary
// dot inside a soft halo. Renders nothing without a key, after a load
// failure, or with no located building, so the page never shows a broken
// map.
export function CampusMap({ pins, position, onRequestPosition, onSelect }: CampusMapProps) {
  const [pref, setPref] = useMapPref();
  const [failed, setFailed] = useState(false);
  const [centerTick, setCenterTick] = useState(0);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { resolvedTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";
  const colors = useTokenColors(mounted, dark);

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

  function locate() {
    if (position) setCenterTick((t) => t + 1);
    else onRequestPosition();
  }

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
        <div className="h-[240px] w-full overflow-hidden rounded-lg border border-building-border bg-muted md:h-[320px]">
          <APIProvider apiKey={KEY} onError={() => setFailed(true)}>
            <Map
              key={dark ? "dark" : "light"}
              colorScheme={dark ? "DARK" : "LIGHT"}
              renderingType={RenderingType.RASTER}
              styles={MAP_STYLES}
              defaultBounds={boundsOf(pins)}
              gestureHandling="cooperative"
              clickableIcons={false}
              streetViewControl={false}
              className="h-full w-full"
            >
              <FitPins pins={pins} />
              <CenterOnPerson position={position} tick={centerTick} />
              <MapControl position={ControlPosition.RIGHT_BOTTOM}>
                {/* Same box, shadow and icon colors as Google's own controls in each scheme. */}
                <button
                  type="button"
                  onClick={locate}
                  aria-label="Center the map on me"
                  className={cn(
                    "m-2.5 flex size-10 items-center justify-center rounded-[2px] shadow-[0_1px_4px_-1px_rgba(0,0,0,0.3)]",
                    dark ? "bg-[#444] text-[#b3b3b3] hover:text-white" : "bg-white text-[#666] hover:text-[#333]"
                  )}
                >
                  <LocateFixed className="size-[18px]" aria-hidden />
                </button>
              </MapControl>
              <SpotMarkers pins={pins} position={position} colors={colors} onSelect={onSelect} />
            </Map>
          </APIProvider>
        </div>
      ) : null}
    </div>
  );
}

interface TokenColors {
  theme: string;
  primary: string;
  state: Record<BuildingState, string>;
}

interface SpotMarkersProps {
  pins: MapPin[];
  position: LatLng | null;
  colors: TokenColors | null;
  onSelect: (buildingId: string) => void;
}

// The pins and the person. Rendered only once the map instance exists, so
// the Google symbol constants are there to read.
function SpotMarkers({ pins, position, colors, onSelect }: SpotMarkersProps) {
  const map = useMap();
  if (!map || !colors) return null;
  return (
    <>
      {pins
        .filter((p) => p.shown)
        .map((p) => (
          <Marker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.name}
            onClick={() => onSelect(p.id)}
            zIndex={2}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 15,
              fillColor: colors.state[p.state],
              fillOpacity: 1,
              strokeColor: colors.primary,
              strokeWeight: 2,
            }}
            label={{
              text: p.offline ? "?" : String(p.free),
              color: "#ffffff",
              fontFamily: "JetBrains Mono, ui-monospace, monospace",
              fontSize: "12px",
              fontWeight: "700",
            }}
          />
        ))}
      {position ? (
        <>
          <Marker
            position={position}
            clickable={false}
            zIndex={0}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 22,
              fillColor: colors.primary,
              fillOpacity: 0.25,
              strokeWeight: 0,
            }}
          />
          <Marker
            position={position}
            title="You"
            clickable={false}
            zIndex={1}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: colors.primary,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            }}
          />
        </>
      ) : null}
    </>
  );
}

// The classic marker takes color strings, so the state and primary tokens
// are read off the document, again when the theme flips.
function useTokenColors(mounted: boolean, dark: boolean): TokenColors | null {
  return useMemo(() => {
    if (!mounted) return null;
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();
    return {
      theme: dark ? "dark" : "light",
      primary: read("--primary"),
      state: {
        empty: read(STATE_TOKEN.empty),
        shared: read(STATE_TOKEN.shared),
        full: read(STATE_TOKEN.full),
        unknown: read(STATE_TOKEN.unknown),
      } as Record<BuildingState, string>,
    };
  }, [mounted, dark]);
}

// Bounds around every located building, never narrower than about 400 m
// so a single building does not zoom to the rooftop.
function boundsOf(pins: MapPin[]): google.maps.LatLngBoundsLiteral {
  let north = -90, south = 90, east = -180, west = 180;
  for (const p of pins) {
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

// Refits only when the set of located buildings changes, never on a count
// change or a filter, so the map holds still while numbers move.
function FitPins({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  const ids = pins.map((p) => p.id).join(",");
  useEffect(() => {
    if (!map) return;
    map.fitBounds(boundsOf(pins), 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ids]);
  return null;
}

// Centers on the person once the first fix arrives, and again on every
// press of the locate control.
function CenterOnPerson({ position, tick }: { position: LatLng | null; tick: number }) {
  const map = useMap();
  const located = position != null;
  useEffect(() => {
    if (!map || !position) return;
    map.panTo(position);
    map.setZoom(PERSON_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, located, tick]);
  return null;
}
