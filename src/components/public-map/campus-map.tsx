"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  APIProvider,
  ControlPosition,
  Map,
  MapControl,
  Marker,
  RenderingType,
  useMap,
} from "@vis.gl/react-google-maps";
import { LocateFixed, Maximize2, X } from "lucide-react";
import { useTheme } from "next-themes";
import type { LatLng } from "@/lib/geo";
import type { BuildingState } from "@/lib/occupancy";
import { useMapPref } from "@/lib/prefs";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { bandIconClass } from "@/components/band";
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
  // View on map from the directory: shows the map, scrolls to it and zooms
  // to that building. The tick changes on every press.
  target: { id: string; tick: number } | null;
}

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const noop = () => () => {};
const PERSON_ZOOM = 16;
const BUILDING_ZOOM = 18;
// View on map is offered only where the map can render at all.
export const mapAvailable = Boolean(KEY);
// Every demo building is on one campus, so the merged dot carries its name.
const CAMPUS_NAME = "CSUN";
// Pin circle radius in pixels, stroke included.
const PIN_RADIUS = 17;
// Label line: its vertical center sits this far below the pin's center.
const LABEL_OFFSET = 26;
const LABEL_HEIGHT = 16;
const LABEL_FONT = "600 12px DM Sans, sans-serif";

// Google's own points of interest and transit icons stay off, so the only
// markers on the map are Spot's. Styles need a raster map, and the classic
// marker needs no map id.
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

// A 1x1 transparent icon carries the building name label under each pin.
const BLANK_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

const STATE_TOKEN: Record<BuildingState, string> = {
  // Public map levels: navy empty, periwinkle some seats, grey full.
  empty: "--primary",
  some: "--seat-some",
  full: "--muted-foreground",
  unknown: "--state-unknown",
};

// One pin per building that has a location, in the building's state color
// with its free total inside and a primary outline, the building's name
// under it where it fits. The person is a primary dot inside a soft halo. Renders nothing without a key, after a load
// failure, or with no located building, so the page never shows a broken
// map. On touch devices the inline map is a still preview: a tap opens it
// full screen (focus), where one finger pans and a pinch zooms the map, never
// the page. A pin tap there closes focus and jumps to the building.
export function CampusMap({ pins, position, onRequestPosition, onSelect, target }: CampusMapProps) {
  const [pref, setPref] = useMapPref();
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [centerTick, setCenterTick] = useState(0);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { resolvedTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";
  const colors = useTokenColors(mounted, dark);
  const coarse = useCoarsePointer();
  const [expanded, setExpanded] = useState(false);
  const focusMode = coarse && expanded;
  const preview = coarse && !expanded;

  // An invalid or restricted key fails after the script loads, through
  // this global rather than the provider's onError.
  useEffect(() => {
    const w = window as Window & { gm_authFailure?: () => void };
    w.gm_authFailure = () => setFailed(true);
    return () => {
      delete w.gm_authFailure;
    };
  }, []);

  // View on map: on touch it opens focus, elsewhere it scrolls to the map.
  const targetTick = target?.tick;
  const [seenTarget, setSeenTarget] = useState(targetTick);
  if (targetTick !== seenTarget) {
    setSeenTarget(targetTick);
    if (coarse && targetTick != null) setExpanded(true);
  }
  useEffect(() => {
    if (targetTick == null) return;
    setPref("shown");
    if (!coarse) ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetTick]);

  // Focus holds the page still and closes on Escape.
  useEffect(() => {
    if (!focusMode) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [focusMode]);

  if (!KEY || failed || pins.length === 0) return null;
  const shown = pref === "shown";

  function locate() {
    if (position) setCenterTick((t) => t + 1);
    else onRequestPosition();
  }

  // The list scroll waits a frame: out of focus first on touch, and on
  // desktop Google moves keyboard focus onto the marker on its first click,
  // which cancels a smooth scroll started in the same frame. The marker
  // lets go of focus too, so nothing pulls the page back to the map. In
  // Google's full screen view the page is hidden, so that closes first.
  function select(id: string) {
    if (focusMode) setExpanded(false);
    const active = document.activeElement;
    if (active instanceof HTMLElement && ref.current?.contains(active)) active.blur();
    const go = () => requestAnimationFrame(() => onSelect(id));
    if (document.fullscreenElement) document.exitFullscreen().then(go, go);
    else go();
  }

  const controlClass = cn(
    "m-2.5 flex size-10 items-center justify-center rounded-[2px] shadow-[0_1px_4px_-1px_rgba(0,0,0,0.3)]",
    dark ? "bg-[#444] text-[#b3b3b3] hover:text-white" : "bg-white text-[#666] hover:text-[#333]"
  );

  return (
    <div ref={ref} className="flex scroll-mt-4 flex-col gap-1">
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
        <div className="h-[240px] md:h-[320px]">
          <div
            className={cn(
              focusMode
                ? "fixed inset-0 z-50 flex h-dvh flex-col bg-background"
                : "relative h-full w-full overflow-hidden rounded-lg border border-building-border bg-muted"
            )}
          >
            {focusMode ? (
              <div className="flex h-14 shrink-0 items-center justify-between gap-4 bg-band px-4 text-band-foreground">
                <span className="text-lg font-semibold">Campus map</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={bandIconClass}
                  aria-label="Close map"
                  onClick={() => setExpanded(false)}
                >
                  <X aria-hidden />
                </Button>
              </div>
            ) : null}
            <div className="relative min-h-0 flex-1 h-full">
              <APIProvider apiKey={KEY} onError={() => setFailed(true)}>
                <Map
                  key={dark ? "dark" : "light"}
                  colorScheme={dark ? "DARK" : "LIGHT"}
                  renderingType={RenderingType.RASTER}
                  styles={MAP_STYLES}
                  defaultBounds={boundsOf(pins)}
                  gestureHandling={preview ? "none" : focusMode ? "greedy" : "cooperative"}
                  disableDefaultUI={preview}
                  clickableIcons={false}
                  streetViewControl={false}
                  fullscreenControl={!coarse}
                  className="h-full w-full"
                >
                  <FitPins pins={pins} />
                  <CenterOnPerson position={position} tick={centerTick} />
                  <FlyToBuilding pins={pins} target={target} />
                  {preview ? (
                    <MapControl position={ControlPosition.RIGHT_TOP}>
                      <span className={controlClass} aria-hidden>
                        <Maximize2 className="size-[18px]" />
                      </span>
                    </MapControl>
                  ) : (
                    <MapControl position={ControlPosition.RIGHT_BOTTOM}>
                      {/* Same box, shadow and icon colors as Google's own controls in each scheme. */}
                      <button type="button" onClick={locate} aria-label="Center the map on me" className={controlClass}>
                        <LocateFixed className="size-[18px]" aria-hidden />
                      </button>
                    </MapControl>
                  )}
                  <SpotMarkers
                    pins={pins}
                    position={position}
                    colors={colors}
                    onSelect={select}
                    targetId={target?.id ?? null}
                  />
                </Map>
              </APIProvider>
              {preview ? (
                <button
                  type="button"
                  aria-label="Expand map"
                  className="absolute inset-0 z-10 cursor-pointer"
                  onClick={() => setExpanded(true)}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface TokenColors {
  theme: string;
  primary: string;
  // Navy, for pin labels on a light fill.
  ink: string;
  foreground: string;
  state: Record<BuildingState, string>;
}

interface SpotMarkersProps {
  pins: MapPin[];
  position: LatLng | null;
  colors: TokenColors | null;
  onSelect: (buildingId: string) => void;
  // The building last viewed from the directory: its name is placed first.
  targetId: string | null;
}

// The pins and the person. Rendered only once the map instance exists, so
// the Google symbol constants are there to read. A name label is left out
// when it would cover another pin or a label already placed, so zooming out
// never stacks text. Once every pin sits within two pin widths of their
// middle, the circles are one blob, so they merge into one campus dot; a
// tap on it fits the map to the buildings again.
function SpotMarkers({ pins, position, colors, onSelect, targetId }: SpotMarkersProps) {
  const map = useMap();
  const zoom = useZoom(map);
  if (!map || !colors || zoom == null) return null;
  const shown = pins.filter((p) => p.shown);
  const points = shown.map((p) => toPixel(p, zoom));
  const merged = shown.length > 1 && spread(points) < PIN_RADIUS * 4;
  const labeled = merged ? new Set<string>() : placeLabels(shown, points, targetId);

  const pinMarker = (p: Pick<MapPin, "lat" | "lng" | "name" | "free" | "offline" | "state">, onClick: () => void) => (
    <Marker
      position={{ lat: p.lat, lng: p.lng }}
      title={p.name}
      onClick={onClick}
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
        // Navy on the light fills (some seats in light, empty in dark).
        color: (colors.theme === "dark" ? p.state === "empty" : p.state === "some") ? colors.ink : "#ffffff",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: "12px",
        fontWeight: "700",
      }}
    />
  );
  const nameMarker = (p: Pick<MapPin, "lat" | "lng" | "name">) => (
    <Marker
      position={{ lat: p.lat, lng: p.lng }}
      clickable={false}
      zIndex={1}
      icon={{
        url: BLANK_ICON,
        scaledSize: new google.maps.Size(1, 1),
        anchor: new google.maps.Point(0, 0),
        labelOrigin: new google.maps.Point(0, LABEL_OFFSET),
      }}
      label={{
        text: p.name,
        className: "spot-pin-label",
        color: colors.foreground,
        fontFamily: "DM Sans, sans-serif",
        fontSize: "12px",
        fontWeight: "600",
      }}
    />
  );

  return (
    <>
      {merged ? (
        <Fragment key="campus">
          {pinMarker(campusPin(shown), () => map.fitBounds(boundsOf(shown), 24))}
          {nameMarker(campusPin(shown))}
        </Fragment>
      ) : (
        shown.map((p) => (
          <Fragment key={p.id}>
            {pinMarker(p, () => onSelect(p.id))}
            {labeled.has(p.id) ? nameMarker(p) : null}
          </Fragment>
        ))
      )}
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

// The map's zoom, kept in state so the markers re-place their labels on
// every zoom step. Panning moves every pin together, so it needs nothing.
function useZoom(map: google.maps.Map | null): number | null {
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    if (!map) return;
    const read = () => {
      const z = map.getZoom();
      if (z != null) setZoom(z);
    };
    read();
    const listener = map.addListener("zoom_changed", read);
    return () => listener.remove();
  }, [map]);
  return zoom;
}

interface Point {
  x: number;
  y: number;
}

// Web Mercator world pixels at this zoom. Only the distances between pins
// matter, so the map's own offset is not needed.
function toPixel(p: LatLng, zoom: number): Point {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((p.lat * Math.PI) / 180);
  return {
    x: ((p.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

// Largest pixel distance from the middle of the pins to any one of them.
function spread(points: Point[]): number {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return Math.max(...points.map((p) => Math.hypot(p.x - cx, p.y - cy)));
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

let measureContext: CanvasRenderingContext2D | null | undefined;
function labelWidth(text: string): number {
  if (measureContext === undefined) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * 7;
  measureContext.font = LABEL_FONT;
  return measureContext.measureText(text).width + 8;
}

// The ids whose name label fits: the first id's label goes first, then in
// order, each label is kept only if it clears every pin circle and every
// label kept before it.
function placeLabels(pins: MapPin[], points: Point[], firstId: string | null): Set<string> {
  const circles: Box[] = points.map((p) => ({
    left: p.x - PIN_RADIUS,
    right: p.x + PIN_RADIUS,
    top: p.y - PIN_RADIUS,
    bottom: p.y + PIN_RADIUS,
  }));
  const placed: Box[] = [];
  const ids = new Set<string>();
  const order = pins.map((_, i) => i).sort((a, b) => Number(pins[b].id === firstId) - Number(pins[a].id === firstId));
  order.forEach((i) => {
    const pin = pins[i];
    const half = labelWidth(pin.name) / 2;
    const cy = points[i].y + LABEL_OFFSET;
    const box = {
      left: points[i].x - half,
      right: points[i].x + half,
      top: cy - LABEL_HEIGHT / 2,
      bottom: cy + LABEL_HEIGHT / 2,
    };
    if (circles.some((c) => overlaps(box, c)) || placed.some((b) => overlaps(box, b))) return;
    placed.push(box);
    ids.add(pin.id);
  });
  return ids;
}

// The merged dot: in the middle of the buildings, with the campus free
// total. Unknown when every building is offline, empty or full only when
// every reporting building is, some seats otherwise.
function campusPin(pins: MapPin[]) {
  const reporting = pins.filter((p) => !p.offline);
  const states = new Set(reporting.map((p) => p.state));
  const state: BuildingState =
    reporting.length === 0 ? "unknown" : states.size === 1 ? [...states][0] : "some";
  return {
    name: CAMPUS_NAME,
    lat: pins.reduce((sum, p) => sum + p.lat, 0) / pins.length,
    lng: pins.reduce((sum, p) => sum + p.lng, 0) / pins.length,
    free: reporting.reduce((sum, p) => sum + p.free, 0),
    offline: reporting.length === 0,
    state,
  };
}

// The classic marker takes color strings, so the state and primary tokens
// are read off the document, again when the theme flips. next-themes sets
// the .dark class in its own effect, after this one, so the read waits a
// frame. Building names are white in dark, ink in light.
function useTokenColors(mounted: boolean, dark: boolean): TokenColors | null {
  const [colors, setColors] = useState<TokenColors | null>(null);
  useEffect(() => {
    if (!mounted) return;
    const frame = requestAnimationFrame(() => {
      const style = getComputedStyle(document.documentElement);
      const read = (name: string) => style.getPropertyValue(name).trim();
      setColors({
        theme: dark ? "dark" : "light",
        primary: read("--primary"),
        ink: read(dark ? "--primary-foreground" : "--primary"),
        foreground: dark ? "#ffffff" : read("--foreground"),
        state: {
          empty: read(STATE_TOKEN.empty),
          some: read(STATE_TOKEN.some),
          full: read(STATE_TOKEN.full),
          unknown: read(STATE_TOKEN.unknown),
        } as Record<BuildingState, string>,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [mounted, dark]);
  return colors;
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

// Zooms to the building on every View on map press. A map that mounts for
// the press applies its first fit late, so the zoom is set again once the
// map settles.
function FlyToBuilding({ pins, target }: { pins: MapPin[]; target: CampusMapProps["target"] }) {
  const map = useMap();
  const tick = target?.tick;
  useEffect(() => {
    const pin = pins.find((p) => p.id === target?.id);
    if (!map || !pin) return;
    const apply = () => {
      map.setZoom(BUILDING_ZOOM);
      map.panTo({ lat: pin.lat, lng: pin.lng });
    };
    apply();
    const listener = google.maps.event.addListenerOnce(map, "idle", apply);
    return () => listener.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tick]);
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
