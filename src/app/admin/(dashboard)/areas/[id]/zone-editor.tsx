"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createZone, deleteZone, updateZone, type ZoneInput } from "@/app/admin/actions";
import type { Polygon, Zone, ZoneType } from "@/lib/types";
import { countText, stateColor, tileState } from "@/lib/occupancy";
import { type LiveFrame, useLiveFrame } from "@/hooks/use-live-frame";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CLOSE_RADIUS, ZoneCanvas, distance } from "./zone-canvas";

interface ZoneEditorProps {
  roomId: string;
  zones: Zone[];
  onZonesChange: (next: Zone[]) => void;
  counts: Record<string, number | undefined>;
  liveFrame: LiveFrame | null;
  now: number;
}

interface ZoneFields {
  name: string;
  type: ZoneType;
  capacity: string;
}

function fieldsFromZone(zone: Zone): ZoneFields {
  return {
    name: zone.name,
    type: zone.type === "line" ? "open" : zone.type,
    capacity: zone.capacity != null ? String(zone.capacity) : "",
  };
}

function toInput(fields: ZoneFields, polygon: Polygon): ZoneInput {
  const cap = fields.capacity.trim() === "" ? null : Number(fields.capacity);
  return {
    name: fields.name.trim(),
    type: fields.type,
    capacity: fields.type === "seating" && cap != null && !Number.isNaN(cap) ? cap : null,
    polygon,
  };
}

// "Table 5": the last zone's prefix with the next number. "Table 1" when
// there are no zones yet.
export function suggestName(zones: Zone[]): string {
  if (zones.length === 0) return "Table 1";
  const last = zones[zones.length - 1];
  const m = last.name.match(/^(.*?)(\d+)\s*$/);
  const prefix = m ? m[1] : `${last.name} `;
  const taken = new Set(zones.map((z) => z.name.trim()));
  let n = m ? Number(m[2]) + 1 : 2;
  while (taken.has(`${prefix}${n}`.trim())) n++;
  return `${prefix}${n}`.trim();
}

// The zone editor: toolbar, canvas, and the side panel with the zone list
// and the editor for the selected zone (or the naming step for a new one).
// Saves and deletes update the list locally first, then reconcile.
export function ZoneEditor({ roomId, zones, onZonesChange, counts, liveFrame, now }: ZoneEditorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<Polygon>([]);
  const [uploadedSrc, setUploadedSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const live = useLiveFrame(liveFrame, drawing);
  const frameSrc = uploadedSrc ?? live.src;

  // Either the selected saved zone or the polygon waiting for a name.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingPolygon, setPendingPolygon] = useState<Polygon | null>(null);
  const [fields, setFields] = useState<ZoneFields>({ name: "", type: "seating", capacity: "" });

  const selected = zones.find((z) => z.id === selectedId) ?? null;
  const lastSeating = [...zones].reverse().find((z) => z.type === "seating" && z.capacity != null);

  // Keyboard while drawing: Escape cancels, Backspace undoes, Enter closes.
  useEffect(() => {
    if (!drawing) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "Escape") cancelDrawing();
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        setDraft((d) => d.slice(0, -1));
      }
      if (e.key === "Enter") finishDrawing();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, draft]);

  useEffect(() => {
    return () => {
      if (uploadedSrc) URL.revokeObjectURL(uploadedSrc);
    };
  }, [uploadedSrc]);

  function select(zoneId: string | null) {
    setSelectedId(zoneId);
    setPendingPolygon(null);
    const zone = zones.find((z) => z.id === zoneId);
    if (zone) setFields(fieldsFromZone(zone));
  }

  function startDrawing() {
    setDrawing(true);
    setDraft([]);
    setSelectedId(null);
    setPendingPolygon(null);
  }

  function cancelDrawing() {
    setDrawing(false);
    setDraft([]);
  }

  function finishDrawing() {
    if (draft.length < 3) return;
    const polygon = draft;
    setDrawing(false);
    setDraft([]);
    setSelectedId(null);
    setPendingPolygon(polygon);
    const last = zones[zones.length - 1];
    setFields({
      name: suggestName(zones),
      type: last ? (last.type === "line" ? "open" : last.type) : "seating",
      capacity: lastSeating?.capacity != null ? String(lastSeating.capacity) : "4",
    });
  }

  function onCanvasClick(point: [number, number]) {
    if (!drawing) {
      select(null);
      return;
    }
    if (draft.length >= 3 && distance(point, draft[0]) <= CLOSE_RADIUS) {
      finishDrawing();
      return;
    }
    setDraft((d) => [...d, [Math.round(point[0]), Math.round(point[1])]]);
  }

  function onFrameChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadedSrc(URL.createObjectURL(file));
    event.target.value = "";
  }

  // Commits the server's view of the zones together with the local override,
  // so nothing flickers back to the old row while the refresh is in flight.
  function reconcile(next: Zone[]) {
    startTransition(() => {
      onZonesChange(next);
      router.refresh();
    });
  }

  function saveNewZone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingPolygon) return;
    const input = toInput(fields, pendingPolygon);
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Zone = { id: tempId, room_id: roomId, ...input };
    const before = zones;
    onZonesChange([...zones, optimistic]);
    setPendingPolygon(null);
    setSelectedId(tempId);
    startTransition(async () => {
      const result = await createZone(roomId, input);
      if (result.error || !result.id) {
        toast(result.error ?? "Could not save the zone.");
        onZonesChange(before);
        setSelectedId(null);
        return;
      }
      const saved: Zone = { ...optimistic, id: result.id };
      setSelectedId(result.id);
      reconcile([...before, saved]);
      toast("Zone saved.", { action: undoAction(() => removeZone(saved, { silent: true })) });
    });
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const previous = selected;
    const input = toInput(fields, selected.polygon);
    const updated: Zone = { ...selected, ...input };
    onZonesChange(zones.map((z) => (z.id === selected.id ? updated : z)));
    startTransition(async () => {
      const result = await updateZone(selected.id, roomId, input);
      if (result.error) {
        toast(result.error);
        onZonesChange(zones.map((z) => (z.id === previous.id ? previous : z)));
        return;
      }
      reconcile(zones.map((z) => (z.id === selected.id ? updated : z)));
      toast("Zone saved.", { action: undoAction(() => restoreZone(previous)) });
    });
  }

  function restoreZone(previous: Zone) {
    onZonesChange(zones.map((z) => (z.id === previous.id ? previous : z)));
    setFields(fieldsFromZone(previous));
    startTransition(async () => {
      const result = await updateZone(previous.id, roomId, toInput(fieldsFromZone(previous), previous.polygon));
      if (result.error) toast(result.error);
      router.refresh();
    });
  }

  function removeZone(zone: Zone, opts: { silent?: boolean } = {}) {
    const before = zones;
    onZonesChange(zones.filter((z) => z.id !== zone.id));
    if (selectedId === zone.id) setSelectedId(null);
    startTransition(async () => {
      const result = await deleteZone(zone.id, roomId);
      if (result.error) {
        toast(result.error);
        onZonesChange(before);
        return;
      }
      reconcile(before.filter((z) => z.id !== zone.id));
      if (!opts.silent) {
        toast("Zone deleted.", { action: undoAction(() => recreateZone(zone)) });
      }
    });
  }

  function recreateZone(zone: Zone) {
    const input = toInput(fieldsFromZone(zone), zone.polygon);
    onZonesChange([...zones, zone]);
    startTransition(async () => {
      const result = await createZone(roomId, input);
      if (result.error || !result.id) {
        toast(result.error ?? "Could not restore the zone.");
        onZonesChange(zones);
        return;
      }
      reconcile([...zones, { ...zone, id: result.id }]);
    });
  }

  const points = draft.length;
  const editing = selected && !pendingPolygon;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {drawing ? (
            <>
              <Button onClick={finishDrawing} disabled={points < 3}>
                Finish zone
              </Button>
              <Button variant="outline" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={points === 0}>
                Undo point
              </Button>
              <Button variant="ghost" onClick={cancelDrawing}>
                Cancel
              </Button>
              <span className="ml-auto text-[13px] text-muted-foreground">
                {points} {points === 1 ? "point" : "points"}. Click near the first point to close.
              </span>
            </>
          ) : (
            <>
              <Button size="lg" onClick={startDrawing}>
                Draw a zone
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Upload photo
              </Button>
              {uploadedSrc ? (
                <Button variant="ghost" onClick={() => setUploadedSrc(null)}>
                  Back to the live frame
                </Button>
              ) : null}
              <span className="ml-auto text-[13px] text-muted-foreground">
                {uploadedSrc
                  ? "Uploaded photo"
                  : !liveFrame
                    ? "No camera unit paired"
                    : live.loadedAt
                      ? `Live frame, ${Math.max(0, Math.round((now - live.loadedAt) / 1000))} s ago`
                      : "Waiting for the first frame"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFrameChosen}
              />
            </>
          )}
        </div>

        <ZoneCanvas
          frameSrc={frameSrc}
          zones={zones}
          counts={counts}
          selectedId={pendingPolygon ? null : selectedId}
          draft={pendingPolygon ?? draft}
          drawing={drawing}
          onCanvasClick={onCanvasClick}
          onZoneClick={(id) => select(id === selectedId ? null : id)}
        />
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span>1280 x 720{liveFrame ? ` from ${liveFrame.unitName}` : ""}</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" aria-label="What the canvas shows">
                <Info className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-3 text-[13px]">
              <dl className="space-y-2">
                <div>
                  <dt className="font-medium text-foreground">Box</dt>
                  <dd className="text-muted-foreground">A person the camera unit detected.</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Dot</dt>
                  <dd className="text-muted-foreground">
                    The bottom center of that box, where the feet are. A person is in a zone when the dot is
                    inside it.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Zone fill</dt>
                  <dd className="text-muted-foreground">
                    Green is empty, orange has people, red is at capacity. The label shows the count.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Dashed outline</dt>
                  <dd className="text-muted-foreground">
                    A zone being drawn. Click near the first point to close it.
                  </dd>
                </div>
              </dl>
              <p className="text-muted-foreground">
                Feet are used instead of the whole box because the camera unit looks down from a corner.
                Heads and shoulders lean over tables and across zone edges, but feet stay on the floor
                where the person actually is. Draw zones around the floor space, not the furniture.
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Zones</h2>
          {zones.length === 0 && !pendingPolygon ? (
            <p className="mt-2 text-sm text-muted-foreground">No zones yet. Draw the first one.</p>
          ) : (
            <ul className="mt-2">
              {zones.map((zone) => {
                const active = zone.id === selectedId && !pendingPolygon;
                const raw = counts[zone.id];
                return (
                  <li key={zone.id}>
                    <button
                      type="button"
                      onClick={() => select(active ? null : zone.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-2 py-2 text-left text-sm hover:bg-card",
                        active && "bg-card"
                      )}
                    >
                      <span
                        className="size-[10px] shrink-0"
                        style={{ backgroundColor: stateColor(tileState(zone.type, raw ?? 0, zone.capacity)) }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{zone.name}</span>
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">
                        {raw == null ? "" : countText(zone, raw)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {pendingPolygon ? (
          <form onSubmit={saveNewZone} className="space-y-4 bg-card p-4 shadow-sm">
            <h3 className="text-[15px] font-semibold">Name the new zone</h3>
            <ZoneFieldInputs
              idPrefix="new"
              fields={fields}
              onChange={setFields}
              helper={
                lastSeating
                  ? "Same as the other tables. Change if this one differs."
                  : `Full at ${fields.capacity || "4"}. Shared from 1.`
              }
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit">Save zone</Button>
              <Button type="button" variant="ghost" onClick={() => setPendingPolygon(null)}>
                Discard
              </Button>
            </div>
          </form>
        ) : editing ? (
          <form onSubmit={saveEdit} className="space-y-4 bg-card p-4 shadow-sm">
            <ZoneFieldInputs
              idPrefix="edit"
              fields={fields}
              onChange={setFields}
              helper={`Full at ${fields.capacity || "?"}. Shared from 1.`}
            />
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="ghost" onClick={() => removeZone(selected)}>
                Delete zone
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

interface ZoneFieldInputsProps {
  idPrefix: string;
  fields: ZoneFields;
  onChange: (next: ZoneFields) => void;
  helper: string;
  autoFocus?: boolean;
}

function ZoneFieldInputs({ idPrefix, fields, onChange, helper, autoFocus }: ZoneFieldInputsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={fields.name}
          onChange={(e) => onChange({ ...fields, name: e.target.value })}
          placeholder="Table 3"
          required
          autoFocus={autoFocus}
        />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Tabs value={fields.type} onValueChange={(v) => onChange({ ...fields, type: v as ZoneType })}>
          <TabsList className="w-full">
            <TabsTrigger value="seating">Seating</TabsTrigger>
            <TabsTrigger value="open">Open area</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {fields.type === "seating" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-capacity`}>Seats</Label>
          <Input
            id={`${idPrefix}-capacity`}
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={fields.capacity}
            onChange={(e) => onChange({ ...fields, capacity: e.target.value })}
            placeholder="4"
            className="font-mono"
          />
          <p className="text-[13px] text-muted-foreground">{helper}</p>
        </div>
      ) : null}
    </div>
  );
}

function undoAction(run: () => void) {
  return { label: "Undo", onClick: run };
}
