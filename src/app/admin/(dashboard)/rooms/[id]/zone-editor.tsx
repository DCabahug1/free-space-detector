"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ImageUp,
  Loader2,
  Pause,
  PenLine,
  Play,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createZone,
  deleteZone,
  updateZone,
  type ZoneInput,
} from "@/app/admin/actions";
import type { Polygon, Room, Zone, ZoneType } from "@/lib/types";
import { ZONE_TYPE_LABEL, displayCount } from "@/lib/occupancy";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CLOSE_RADIUS, ZONE_COLORS, ZoneCanvas, distance } from "./zone-canvas";
import { type LiveFrame, useLiveFrame } from "@/hooks/use-live-frame";
import { useZoneCounts } from "@/hooks/use-zone-counts";

interface ZoneEditorProps {
  room: Room;
  zones: Zone[];
  counts: Record<string, number>;
  liveFrame: LiveFrame | null;
}

interface ZoneFields {
  name: string;
  type: ZoneType;
  capacity: string;
}

const EMPTY_FIELDS: ZoneFields = { name: "", type: "seating", capacity: "4" };

function fieldsFromZone(zone: Zone): ZoneFields {
  return {
    name: zone.name,
    type: zone.type,
    capacity: zone.capacity != null ? String(zone.capacity) : "",
  };
}

function toInput(fields: ZoneFields, polygon: Polygon): ZoneInput {
  const cap = fields.capacity.trim() === "" ? null : Number(fields.capacity);
  return {
    name: fields.name,
    type: fields.type,
    capacity: fields.type === "seating" && cap != null && !Number.isNaN(cap) ? cap : null,
    polygon,
  };
}

export function ZoneEditor({ room, zones, counts: initialCounts, liveFrame }: ZoneEditorProps) {
  const router = useRouter();
  const counts = useZoneCounts(initialCounts);
  const [pending, startTransition] = useTransition();

  // Drawing state. redrawId is set when replacing an existing zone's outline.
  const [drawing, setDrawing] = useState(false);

  // Frame under the canvas. The camera unit's live frame is the default and
  // freezes automatically while drawing. An uploaded photo overrides it.
  const [uploadedSrc, setUploadedSrc] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frozen = paused || drawing;
  const live = useLiveFrame(liveFrame, frozen);
  const frameSrc = uploadedSrc ?? live.src;
  const [draft, setDraft] = useState<Polygon>([]);
  const [redrawId, setRedrawId] = useState<string | null>(null);

  // New zone dialog, opened once a fresh polygon is closed.
  const [newOpen, setNewOpen] = useState(false);
  const [newFields, setNewFields] = useState<ZoneFields>(EMPTY_FIELDS);
  const [newPolygon, setNewPolygon] = useState<Polygon>([]);

  // Selected zone and its edit form.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<ZoneFields>(EMPTY_FIELDS);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selected = zones.find((z) => z.id === selectedId) ?? null;

  // Keep the edit form in sync when the selection or server data changes.
  const lastSynced = useRef<string>("");
  useEffect(() => {
    if (!selected) return;
    const key = `${selected.id}:${selected.name}:${selected.type}:${selected.capacity}`;
    if (key !== lastSynced.current) {
      lastSynced.current = key;
      setEditFields(fieldsFromZone(selected));
    }
  }, [selected]);

  // Keyboard: Escape cancels drawing, Backspace removes the last point.
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

  function startDrawing(replaceId: string | null = null) {
    setDrawing(true);
    setDraft([]);
    setRedrawId(replaceId);
    if (!replaceId) setSelectedId(null);
  }

  function cancelDrawing() {
    setDrawing(false);
    setDraft([]);
    setRedrawId(null);
  }

  function finishDrawing() {
    if (draft.length < 3) {
      toast.error("Click at least 3 points to outline a zone.");
      return;
    }
    const polygon = draft;
    setDrawing(false);
    setDraft([]);

    if (redrawId) {
      const zone = zones.find((z) => z.id === redrawId);
      setRedrawId(null);
      if (!zone) return;
      startTransition(async () => {
        const result = await updateZone(zone.id, room.id, toInput(fieldsFromZone(zone), polygon));
        if (result.error) toast.error(result.error);
        else {
          toast.success(`Outline for ${zone.name} updated.`);
          router.refresh();
        }
      });
      return;
    }

    setNewPolygon(polygon);
    setNewFields({
      ...EMPTY_FIELDS,
      name: `Zone ${zones.length + 1}`,
      type: "seating",
    });
    setNewOpen(true);
  }

  function onCanvasClick(point: [number, number]) {
    if (!drawing) {
      setSelectedId(null);
      return;
    }
    if (draft.length >= 3 && distance(point, draft[0]) <= CLOSE_RADIUS) {
      finishDrawing();
      return;
    }
    setDraft((d) => [...d, [Math.round(point[0]), Math.round(point[1])]]);
  }

  function onZoneClick(zoneId: string) {
    setSelectedId((current) => (current === zoneId ? null : zoneId));
  }

  function onFrameChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadedSrc(URL.createObjectURL(file));
    event.target.value = "";
  }

  function saveNewZone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createZone(room.id, toInput(newFields, newPolygon));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setNewOpen(false);
      setNewPolygon([]);
      toast.success(`${newFields.name} added.`);
      router.refresh();
      if (result.id) setSelectedId(result.id);
    });
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    startTransition(async () => {
      const result = await updateZone(selected.id, room.id, toInput(editFields, selected.polygon));
      if (result.error) toast.error(result.error);
      else {
        toast.success("Zone saved.");
        router.refresh();
      }
    });
  }

  function confirmDelete() {
    if (!selected) return;
    const name = selected.name;
    startTransition(async () => {
      const result = await deleteZone(selected.id, room.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSelectedId(null);
      setDeleteOpen(false);
      toast.success(`${name} deleted.`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {drawing ? (
            <>
              <Button onClick={finishDrawing} disabled={draft.length < 3 || pending}>
                <Check className="size-4" aria-hidden />
                Finish zone
              </Button>
              <Button
                variant="outline"
                onClick={() => setDraft((d) => d.slice(0, -1))}
                disabled={draft.length === 0}
              >
                <Undo2 className="size-4" aria-hidden />
                Undo point
              </Button>
              <Button variant="ghost" onClick={cancelDrawing}>
                <X className="size-4" aria-hidden />
                Cancel
              </Button>
              <span className="text-sm text-muted-foreground">
                {draft.length === 0
                  ? "Click the frame to place the first corner."
                  : draft.length < 3
                    ? `${draft.length} of 3 points. Keep clicking.`
                    : "Click the first point or press Enter to close."}
              </span>
            </>
          ) : (
            <>
              <Button onClick={() => startDrawing()} disabled={pending}>
                <Plus className="size-4" aria-hidden />
                New zone
              </Button>
              {liveFrame && !uploadedSrc ? (
                <Button
                  variant="outline"
                  onClick={() => setPaused((p) => !p)}
                  disabled={!live.src}
                >
                  {paused ? (
                    <Play className="size-4" aria-hidden />
                  ) : (
                    <Pause className="size-4" aria-hidden />
                  )}
                  {paused ? "Resume live frame" : "Freeze frame"}
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <ImageUp className="size-4" aria-hidden />
                {uploadedSrc ? "Replace photo" : "Upload photo"}
              </Button>
              {uploadedSrc ? (
                <Button variant="ghost" onClick={() => setUploadedSrc(null)}>
                  {liveFrame ? "Back to live frame" : "Clear photo"}
                </Button>
              ) : null}
              {liveFrame ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Camera className="size-3.5" aria-hidden />
                  {uploadedSrc
                    ? `Photo (live frame from ${liveFrame.unitName} hidden)`
                    : live.available === false
                      ? `${liveFrame.unitName} has not sent a frame yet`
                      : paused
                        ? `Frozen frame from ${liveFrame.unitName}`
                        : `Live from ${liveFrame.unitName}`}
                </span>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFrameChosen}
              />
            </>
          )}
          {pending ? (
            <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </div>

        <ZoneCanvas
          frameSrc={frameSrc}
          zones={zones}
          counts={counts}
          selectedId={selectedId}
          hiddenId={redrawId}
          draft={draft}
          drawing={drawing}
          onCanvasClick={onCanvasClick}
          onZoneClick={onZoneClick}
        />
        <p className="text-xs text-muted-foreground">
          A person is counted inside a zone when the bottom center of their
          detection box falls within the outline. Draw around the floor area,
          not the furniture top.
          {liveFrame ? " The live frame freezes while you draw." : ""}
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zones</CardTitle>
            <CardDescription>
              {zones.length === 0
                ? "No zones yet. Draw the first one."
                : "Click a zone to edit it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {zones.map((zone) => {
              const active = zone.id === selectedId;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onZoneClick(zone.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                    active && "bg-accent"
                  )}
                >
                  <span
                    className="size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: ZONE_COLORS[zone.type] }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {zone.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ZONE_TYPE_LABEL[zone.type]}
                    {zone.type === "seating" && zone.capacity != null
                      ? ` · ${zone.capacity}`
                      : ""}
                  </span>
                  {counts[zone.id] != null ? (
                    <Badge variant="outline" className="font-mono">
                      {displayCount(zone.type, counts[zone.id], zone.capacity)}
                    </Badge>
                  ) : null}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit zone</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveEdit} className="space-y-4">
                <ZoneFieldInputs
                  idPrefix="edit"
                  fields={editFields}
                  onChange={setEditFields}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={pending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => startDrawing(selected.id)}
                    disabled={pending}
                  >
                    <PenLine className="size-4" aria-hidden />
                    Redraw outline
                  </Button>
                </div>
                <Separator />
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  disabled={pending}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Delete zone
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open) setNewPolygon([]);
        }}
      >
        <DialogContent>
          <form onSubmit={saveNewZone} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Name this zone</DialogTitle>
              <DialogDescription>
                {newPolygon.length} corners drawn. Give it a name students
                recognize.
              </DialogDescription>
            </DialogHeader>
            <ZoneFieldInputs
              idPrefix="new"
              fields={newFields}
              onChange={setNewFields}
              autoFocus
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save zone
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The zone and its live count disappear from the public map.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ZoneFieldInputsProps {
  idPrefix: string;
  fields: ZoneFields;
  onChange: (next: ZoneFields) => void;
  autoFocus?: boolean;
}

function ZoneFieldInputs({ idPrefix, fields, onChange, autoFocus }: ZoneFieldInputsProps) {
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
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <Select
          value={fields.type}
          onValueChange={(v) => onChange({ ...fields, type: v as ZoneType })}
        >
          <SelectTrigger id={`${idPrefix}-type`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="seating">Seating: empty / shared / full</SelectItem>
            <SelectItem value="open">Open area: empty / some / busy</SelectItem>
            {fields.type === "line" ? (
              <SelectItem value="line">Line (deprecated): count and wait estimate</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>
      {fields.type === "seating" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-capacity`}>Capacity</Label>
          <Input
            id={`${idPrefix}-capacity`}
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={fields.capacity}
            onChange={(e) => onChange({ ...fields, capacity: e.target.value })}
            placeholder="4"
          />
          <p className="text-xs text-muted-foreground">
            Seats at this spot. Shows full once this many people are counted.
          </p>
        </div>
      ) : null}
    </div>
  );
}
