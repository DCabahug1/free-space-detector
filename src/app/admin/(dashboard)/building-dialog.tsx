"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Crosshair, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createBuilding, deleteBuilding, updateBuilding } from "@/app/admin/actions";
import type { LatLng } from "@/lib/geo";
import type { Building } from "@/lib/types";
import { useFormDirty } from "@/hooks/use-form-dirty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteTriggerClass } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface BuildingDialogProps {
  // Without a building the dialog creates one, from the "Add a building"
  // button. With one it edits it, from the pencil on its header.
  building?: Building;
  // How many areas the building holds, for the delete confirmation.
  areaCount?: number;
  // Where the map opens for a building without a location: another
  // located building on this campus, if there is one.
  fallbackCenter?: LatLng | null;
}

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const WORLD: LatLng = { lat: 37.3352, lng: -121.8811 };

// Name and map location of a building. The map moves freely under a
// crosshair; "Place pin here" fixes the point, and only another placement,
// an address match or Use my location moves it again. Saving stores the
// pin. Without a Maps key only the name is asked for.
export function BuildingDialog({ building, areaCount = 0, fallbackCenter }: BuildingDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const id = building?.id ?? "new";
  const name = building?.name ?? "";
  const saved: LatLng | null =
    building && building.lat != null && building.lng != null ? { lat: building.lat, lng: building.lng } : null;
  // The pin, null until placed or after Remove location.
  const [center, setCenter] = useState<LatLng | null>(saved);
  // Editing saves only once the name or the pin differs from what is stored.
  const { attach: attachForm, onInput: onFormInput, dirty: formDirty } = useFormDirty();
  const moved = center?.lat !== saved?.lat || center?.lng !== saved?.lng;
  const unchanged = building != null && !formDirty && !moved;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get("name") ?? ""),
      lat: center?.lat ?? null,
      lng: center?.lng ?? null,
    };
    startTransition(async () => {
      const result = building ? await updateBuilding(building.id, input) : await createBuilding(input);
      if (result.error) {
        toast(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!building) return;
    startTransition(async () => {
      const result = await deleteBuilding(building.id);
      if (result.error) {
        toast(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setCenter(saved);
      }}
    >
      <DialogTrigger asChild>
        {building ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-building-muted hover:bg-background dark:hover:bg-background"
            aria-label={`Edit ${name}`}
          >
            <Pencil />
          </Button>
        ) : (
          <Button>Add a building</Button>
        )}
      </DialogTrigger>
      <DialogContent className={KEY ? "sm:max-w-lg" : undefined}>
        <form ref={attachForm} onInput={onFormInput} onSubmit={onSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{building ? "Building" : "New building"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`building-${id}`}>Name</Label>
            <Input
              id={`building-${id}`}
              name="name"
              defaultValue={name}
              placeholder="University Library"
              required
              autoFocus={!KEY || !building}
              maxLength={80}
            />
          </div>
          {KEY ? (
            <APIProvider apiKey={KEY}>
              <LocationPicker
                id={id}
                saved={saved}
                center={center}
                fallbackCenter={fallbackCenter ?? null}
                onChange={setCenter}
              />
            </APIProvider>
          ) : null}
          <DialogFooter className="flex-row items-center justify-between">
            <div>
              {building ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" className={deleteTriggerClass}>
                      Delete building
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {areaCount === 0
                          ? "It has no areas. This cannot be undone."
                          : `Its ${areaCount} ${areaCount === 1 ? "area and its zones go" : "areas and their zones go"} with it. Camera units paired there stay registered. This cannot be undone.`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={onDelete} disabled={pending}>
                        Delete building
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
            <Button type="submit" disabled={pending || unchanged}>
              {pending ? (building ? "Saving" : "Creating") : building ? "Save" : "Create building"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface LocationPickerProps {
  id: string;
  saved: LatLng | null;
  center: LatLng | null;
  fallbackCenter: LatLng | null;
  onChange: (center: LatLng | null) => void;
}

interface Suggestion {
  id: string;
  main: string;
  secondary: string;
  prediction: google.maps.places.PlacePrediction;
}

function LocationPicker({ id, saved, center, fallbackCenter, onChange }: LocationPickerProps) {
  const map = useMap();
  const geocoding = useMapsLibrary("geocoding");
  const places = useMapsLibrary("places");
  const [address, setAddress] = useState("");
  const [finding, setFinding] = useState(false);
  // Pan the map and plant the pin there.
  function moveTo(point: LatLng) {
    onChange(point);
    map?.panTo(point);
    map?.setZoom(17);
  }
  // Place suggestions under the Address field as the admin types. One
  // session token per search so Google bills the keystrokes as one lookup.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const listId = useId();

  useEffect(() => {
    const input = address.trim();
    if (!places || input.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        sessionToken.current ??= new places.AutocompleteSessionToken();
        const bounds = map?.getBounds();
        const { suggestions: found } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionToken.current,
          ...(bounds ? { locationBias: bounds } : {}),
        });
        if (cancelled) return;
        setSuggestions(
          found.flatMap((s) =>
            s.placePrediction
              ? [
                  {
                    id: s.placePrediction.placeId,
                    main: s.placePrediction.mainText?.text ?? s.placePrediction.text.text,
                    secondary: s.placePrediction.secondaryText?.text ?? "",
                    prediction: s.placePrediction,
                  },
                ]
              : []
          )
        );
        setListOpen(true);
        setActive(-1);
      } catch {
        // Places API not enabled for the key, or offline: Find still works.
        if (!cancelled) setSuggestions([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, places, map]);

  async function pick(s: Suggestion) {
    setListOpen(false);
    setAddress(`${s.main}${s.secondary ? `, ${s.secondary}` : ""}`);
    setSuggestions([]);
    sessionToken.current = null;
    try {
      const place = s.prediction.toPlace();
      await place.fetchFields({ fields: ["location"] });
      const loc = place.location;
      if (!loc) {
        toast("No match for that address.");
        return;
      }
      moveTo({ lat: loc.lat(), lng: loc.lng() });
    } catch {
      toast("No match for that address.");
    }
  }
  const start = saved ?? fallbackCenter ?? WORLD;
  const startZoom = saved ? 17 : fallbackCenter ? 15 : 3;

  function placeHere() {
    const c = map?.getCenter();
    if (c) onChange({ lat: c.lat(), lng: c.lng() });
  }

  async function find() {
    const q = address.trim();
    if (!q || !geocoding) return;
    setFinding(true);
    try {
      const { results } = await new geocoding.Geocoder().geocode({ address: q });
      const loc = results[0]?.geometry.location;
      if (!loc) {
        toast("No match for that address.");
        return;
      }
      moveTo({ lat: loc.lat(), lng: loc.lng() });
    } catch {
      toast("No match for that address.");
    } finally {
      setFinding(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast("Location is not available.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => moveTo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast("Location is off for this site."),
      { maximumAge: 60_000, timeout: 10_000 }
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`building-address-${id}`}>Address</Label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              id={`building-address-${id}`}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (e.target.value.trim().length < 3) {
                  setSuggestions([]);
                  setListOpen(false);
                }
              }}
              onFocus={() => suggestions.length > 0 && setListOpen(true)}
              onBlur={() => setListOpen(false)}
              onKeyDown={(e) => {
                const open = listOpen && suggestions.length > 0;
                if (e.key === "ArrowDown" && open) {
                  e.preventDefault();
                  setActive((i) => (i + 1) % suggestions.length);
                } else if (e.key === "ArrowUp" && open) {
                  e.preventDefault();
                  setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                } else if (e.key === "Escape" && open) {
                  e.preventDefault();
                  setListOpen(false);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (open && active >= 0) void pick(suggestions[active]);
                  else void find();
                }
              }}
              placeholder="Street, city"
              autoComplete="off"
              role="combobox"
              aria-expanded={listOpen && suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
            />
            {listOpen && suggestions.length > 0 ? (
              <ul
                id={listId}
                role="listbox"
                aria-label="Address suggestions"
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              >
                {suggestions.map((s, i) => (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void pick(s);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
                      i === active && "bg-accent text-accent-foreground"
                    )}
                  >
                    <span className="block truncate">{s.main}</span>
                    {s.secondary ? (
                      <span className="block truncate text-[13px] text-muted-foreground">{s.secondary}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button type="button" variant="outline" onClick={find} disabled={finding || !geocoding}>
            {finding ? "Finding" : "Find"}
          </Button>
        </div>
      </div>
      <div className="relative h-[240px] w-full overflow-hidden rounded-lg border border-building-border bg-muted">
        <Map
          defaultCenter={start}
          defaultZoom={startZoom}
          gestureHandling="greedy"
          clickableIcons={false}
          streetViewControl={false}
          className="h-full w-full"
        >
          {/* Only once the map exists, so the Google symbol constants are loaded. */}
          {center && map ? (
            <Marker
              position={center}
              clickable={false}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: "#2563eb",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
              }}
            />
          ) : null}
        </Map>
        <Crosshair
          className="pointer-events-none absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-primary"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={placeHere}>
          Place pin here
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
          Use my location
        </Button>
      </div>
      <div className="flex h-8 items-center justify-between gap-3">
        <p className="text-[13px] tabular-nums text-muted-foreground">
          {center ? `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}` : "No pin yet"}
        </p>
        {center ? (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange(null)}>
            Remove location
          </Button>
        ) : null}
      </div>
    </div>
  );
}
