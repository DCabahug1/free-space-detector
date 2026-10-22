"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Crosshair, Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateBuilding } from "@/app/admin/actions";
import type { LatLng } from "@/lib/geo";
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

interface BuildingDialogProps {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  // Where the map opens for a building without a location: another
  // located building on this campus, if there is one.
  fallbackCenter?: LatLng | null;
}

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const WORLD: LatLng = { lat: 37.3352, lng: -121.8811 };

// Pencil on a building header: rename it and set its map location, by
// address or by dragging the map under the crosshair. Saving stores the
// map's center. Without a Maps key only the name can change.
export function BuildingDialog({ id, name, lat, lng, fallbackCenter }: BuildingDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const saved: LatLng | null = lat != null && lng != null ? { lat, lng } : null;
  // The point under the crosshair once placed, null until then or after Remove.
  const [center, setCenter] = useState<LatLng | null>(saved);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateBuilding(id, {
        name: String(form.get("name") ?? ""),
        lat: center?.lat ?? null,
        lng: center?.lng ?? null,
      });
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-building-muted hover:bg-background dark:hover:bg-background"
          aria-label={`Edit ${name}`}
        >
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className={KEY ? "sm:max-w-lg" : undefined}>
        <form onSubmit={onSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Building</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`building-${id}`}>Name</Label>
            <Input id={`building-${id}`} name="name" defaultValue={name} required autoFocus={!KEY} maxLength={80} />
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
          <DialogFooter>
            {KEY && center ? (
              <Button type="button" variant="ghost" onClick={() => setCenter(null)}>
                Remove location
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving" : "Save"}
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

function LocationPicker({ id, saved, center, fallbackCenter, onChange }: LocationPickerProps) {
  const map = useMap();
  const geocoding = useMapsLibrary("geocoding");
  const [address, setAddress] = useState("");
  const [finding, setFinding] = useState(false);
  // Dragging, Find and Use my location all place the point. Until then
  // the map can move without setting a location.
  const [placed, setPlaced] = useState(saved != null);

  const start = saved ?? fallbackCenter ?? WORLD;
  const startZoom = saved ? 17 : fallbackCenter ? 15 : 3;

  function moveTo(point: LatLng) {
    setPlaced(true);
    onChange(point);
    map?.panTo(point);
    map?.setZoom(17);
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
          <Input
            id={`building-address-${id}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void find();
              }
            }}
            placeholder="Street, city"
            autoFocus={saved == null}
            autoComplete="off"
          />
          <Button type="button" variant="outline" onClick={find} disabled={finding || !geocoding}>
            {finding ? "Finding" : "Find"}
          </Button>
        </div>
      </div>
      <div className="relative h-[240px] w-full overflow-hidden rounded-lg border border-building-border bg-muted">
        <Map
          mapId={MAP_ID}
          defaultCenter={start}
          defaultZoom={startZoom}
          gestureHandling="greedy"
          clickableIcons={false}
          className="h-full w-full"
          onDragstart={() => setPlaced(true)}
          onCameraChanged={(e) => {
            if (placed) onChange(e.detail.center);
          }}
        />
        <Crosshair
          className="pointer-events-none absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-primary"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
          Use my location
        </Button>
        <p className="font-mono text-[13px] tabular-nums text-muted-foreground">
          {center ? `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}` : "No location"}
        </p>
      </div>
    </div>
  );
}
