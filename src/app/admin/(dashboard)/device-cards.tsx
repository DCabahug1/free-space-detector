"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { toast } from "sonner";
import {
  assignCameraUnit,
  deleteCameraUnit,
  pairCameraUnit,
  renameCameraUnit,
} from "@/app/admin/actions";
import { useClock } from "@/hooks/use-clock";
import { useLiveFrame } from "@/hooks/use-live-frame";
import { durationText, isOffline } from "@/lib/occupancy";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AdminUnit } from "./admin-types";

export interface RoomOption {
  id: string;
  name: string;
  building: string;
}

const NONE = "__none__";
const THUMB_INTERVAL_MS = 2000;

interface DeviceCardsProps {
  units: (AdminUnit & { frameUrl: string })[];
  rooms: RoomOption[];
}

// Device cards in an auto-fill grid. Each: 16:9 live thumbnail, name,
// assigned room, status line, and a menu with Edit and Remove.
export function DeviceCards({ units, rooms }: DeviceCardsProps) {
  const now = useClock();
  if (units.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No camera units yet. A camera unit shows a pair code on its screen when it starts.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {units.map((unit) => (
        <DeviceCard key={unit.id} unit={unit} rooms={rooms} now={now} />
      ))}
    </div>
  );
}

function DeviceCard({
  unit,
  rooms,
  now,
}: {
  unit: AdminUnit & { frameUrl: string };
  rooms: RoomOption[];
  now: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const offline = isOffline(unit.last_seen, now);
  const frame = useLiveFrame(
    offline ? null : { url: unit.frameUrl, unitName: unit.name, lastSeen: unit.last_seen },
    false,
    THUMB_INTERVAL_MS
  );

  function onEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const roomValue = String(form.get("room_id") ?? NONE);
    startTransition(async () => {
      const renamed = await renameCameraUnit(unit.id, name);
      if (renamed.error) {
        toast(renamed.error);
        return;
      }
      const nextRoom = roomValue === NONE ? null : roomValue;
      if (nextRoom !== unit.room_id) {
        const assigned = await assignCameraUnit(unit.id, nextRoom);
        if (assigned.error) {
          toast(assigned.error);
          return;
        }
      }
      setEditOpen(false);
      toast("Camera unit saved.");
      router.refresh();
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await deleteCameraUnit(unit.id);
      if (result.error) {
        toast(result.error);
        return;
      }
      setRemoveOpen(false);
      toast("Camera unit removed.");
      router.refresh();
    });
  }

  return (
    <div className="bg-card text-card-foreground">
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {!offline && frame.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frame.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        {offline ? (
          <span className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-foreground">
            No frame, offline
          </span>
        ) : frame.src ? (
          <span className="absolute top-2 left-2 bg-foreground px-1.5 py-0.5 text-[11px] font-medium text-background">
            Live
          </span>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-foreground">
            No frame yet
          </span>
        )}
      </div>
      <div className="flex items-start gap-2 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="truncate text-[15px] font-medium">{unit.name}</div>
          <div className="truncate text-[13px] text-muted-foreground">
            {unit.room ? `${unit.room.building.name}, ${unit.room.name}` : "Not paired to an area"}
          </div>
          <div className={cn("text-[13px]", offline ? "text-state-full" : "text-muted-foreground")}>
            {offline
              ? unit.last_seen
                ? `Offline, ${durationText(unit.last_seen, now)}`
                : "Offline, never seen"
              : `Online, ${durationText(unit.last_seen, now)} ago`}
          </div>
          {unit.pair_code ? (
            <div className="font-mono text-[13px] text-muted-foreground">Code {unit.pair_code}</div>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${unit.name}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setRemoveOpen(true)}>
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={onEdit} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Edit camera unit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`unit-name-${unit.id}`}>Name</Label>
                <Input id={`unit-name-${unit.id}`} name="name" defaultValue={unit.name} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`unit-room-${unit.id}`}>Area</Label>
                <Select name="room_id" defaultValue={unit.room_id ?? NONE}>
                  <SelectTrigger id={`unit-room-${unit.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not paired</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.building}, {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {unit.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its room assignment and pair code are forgotten. The unit keeps running and shows a
              new pair code the next time its script starts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onRemove} disabled={pending}>
              Remove camera unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface PairFormProps {
  rooms: RoomOption[];
  initialCode?: string;
  // On the setup page the room is fixed and the select is hidden.
  fixedRoomId?: string;
  onPaired?: (unit: { id: string; name: string }) => void;
}

// Code input, room select (unless fixed), Pair button.
export function PairForm({ rooms, initialCode = "", fixedRoomId, onPaired }: PairFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [roomId, setRoomId] = useState<string>(fixedRoomId ?? rooms[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await pairCameraUnit(code, roomId);
      if (result.error) {
        toast(result.error);
        return;
      }
      toast(`Paired ${result.unit?.name ?? "camera unit"}.`);
      setCode("");
      if (result.unit) onPaired?.(result.unit);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000 000"
        aria-label="Pair code"
        className="font-mono text-lg"
        required
        autoFocus
      />
      {fixedRoomId ? null : (
        <div className="space-y-2">
          <Label htmlFor="pair-room">Area</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger id="pair-room" className="w-full">
              <SelectValue placeholder="Pick an area" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.building}, {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" disabled={pending || !roomId || code.replace(/\s/g, "").length !== 6}>
        {pending ? "Pairing" : "Pair"}
      </Button>
    </form>
  );
}

// The setup page's inline card: title, caption, and the form.
export function PairCard(props: PairFormProps) {
  return (
    <div className="flex flex-col gap-3 bg-card p-4 text-card-foreground">
      <div>
        <div className="text-[15px] font-medium">Pair a camera unit</div>
        <p className="text-[13px] text-muted-foreground">Type the 6-digit code from its screen.</p>
      </div>
      <PairForm {...props} />
    </div>
  );
}

// The overview's button. Opens on its own when the QR link carries a code.
export function PairDialog({ rooms, initialCode = "" }: { rooms: RoomOption[]; initialCode?: string }) {
  const [open, setOpen] = useState(initialCode !== "");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={rooms.length === 0}>Pair a camera unit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pair a camera unit</DialogTitle>
          <DialogDescription>Type the 6-digit code from its screen.</DialogDescription>
        </DialogHeader>
        <PairForm rooms={rooms} initialCode={initialCode} onPaired={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
