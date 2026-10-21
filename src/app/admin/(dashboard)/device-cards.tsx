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
import { GroupSection, ListFilters } from "@/components/admin/group-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
const UNASSIGNED = "__unassigned__";

type Filter = "all" | "online" | "offline";

interface UnitListProps {
  units: (AdminUnit & { frameUrl: string })[];
  rooms: RoomOption[];
}

// Camera units grouped under collapsible building headers, styled like the
// public map. Units without an area sit in an Unassigned group at the end.
// Search box plus an Online / Offline filter above. Each row: thumbnail,
// name, area, status line, and a menu with Edit and Remove.
export function DeviceCards({ units, rooms }: UnitListProps) {
  const now = useClock();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  if (units.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No camera units yet. A camera unit shows a pair code on its screen when it starts.
      </p>
    );
  }

  const q = query.trim().toLowerCase();
  const visible = units.filter((unit) => {
    const offline = isOffline(unit.last_seen, now);
    if (filter === "online" && (offline || unit.paused)) return false;
    if (filter === "offline" && !offline && !unit.paused) return false;
    if (!q) return true;
    return (
      unit.name.toLowerCase().includes(q) ||
      (unit.pair_code ?? "").includes(q) ||
      (unit.room?.name ?? "").toLowerCase().includes(q) ||
      (unit.room?.building.name ?? "").toLowerCase().includes(q)
    );
  });

  const groups = new Map<string, { name: string; units: typeof units }>();
  for (const unit of visible) {
    const key = unit.room?.building.id ?? UNASSIGNED;
    const g = groups.get(key) ?? { name: unit.room?.building.name ?? "Unassigned", units: [] };
    g.units.push(unit);
    groups.set(key, g);
  }
  const sorted = [...groups.entries()]
    .map(([key, g]) => ({
      key,
      ...g,
      units: [...g.units].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (a.key === UNASSIGNED) return 1;
      if (b.key === UNASSIGNED) return -1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      <ListFilters>
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Camera unit, area or code"
          aria-label="Search camera units"
          className="sm:max-w-xs"
        />
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="online">Online</TabsTrigger>
            <TabsTrigger value="offline">Offline</TabsTrigger>
          </TabsList>
        </Tabs>
      </ListFilters>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q ? `No camera units match "${query.trim()}".` : "No camera units match this filter."}
        </p>
      ) : null}

      {sorted.map((g) => {
        const offlineCount = g.units.filter((u) => isOffline(u.last_seen, now) || u.paused).length;
        return (
          <GroupSection
            key={g.key}
            title={g.name}
            muted={g.key === UNASSIGNED}
            caption={`${g.units.length} ${g.units.length === 1 ? "camera unit" : "camera units"}${
              offlineCount > 0 ? `, ${offlineCount} offline` : ""
            }`}
          >
            {g.units.map((unit) => (
              <UnitRow key={unit.id} unit={unit} rooms={rooms} now={now} />
            ))}
          </GroupSection>
        );
      })}
    </div>
  );
}

function UnitRow({
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
    offline || unit.paused ? null : { url: unit.frameUrl, unitName: unit.name, lastSeen: unit.last_seen },
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

  const status = unit.paused
    ? "Sharing paused"
    : offline
      ? unit.last_seen
        ? `Offline, ${durationText(unit.last_seen, now)}`
        : "Offline, never seen"
      : `Online, ${durationText(unit.last_seen, now)} ago`;

  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3">
      <div className="relative aspect-video w-24 overflow-hidden bg-muted">
        {!offline && !unit.paused && frame.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frame.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
            No frame
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium">{unit.name}</span>
          {unit.pair_code ? (
            <span className="shrink-0 font-mono text-[13px] text-muted-foreground">{unit.pair_code}</span>
          ) : null}
        </div>
        <div className="truncate text-[13px] text-muted-foreground">
          {unit.room ? unit.room.name : "Not paired to an area"}
        </div>
        <div
          className={cn(
            "text-[13px]",
            unit.paused ? "text-state-shared" : offline ? "text-state-full" : "text-muted-foreground"
          )}
        >
          {status}
        </div>
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
              Its area assignment and pair code are forgotten. The unit keeps running and shows a
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
    <div className="flex flex-col gap-3 bg-card p-4 text-card-foreground shadow-sm">
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
        <Button>Pair a camera unit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pair a camera unit</DialogTitle>
          <DialogDescription>
            {rooms.length === 0
              ? "A camera unit is paired to an area. Set up an area first, on the Areas tab."
              : "Type the 6-digit code from its screen."}
          </DialogDescription>
        </DialogHeader>
        {rooms.length > 0 ? (
          <PairForm rooms={rooms} initialCode={initialCode} onPaired={() => setOpen(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
