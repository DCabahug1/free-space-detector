"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { pairCameraUnit } from "@/app/admin/actions";
import { useClock } from "@/hooks/use-clock";
import { useLiveFrame } from "@/hooks/use-live-frame";
import { durationText, isOffline } from "@/lib/occupancy";
import { Button } from "@/components/ui/button";
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

interface DeviceCardsProps {
  units: (AdminUnit & { frameUrl: string })[];
  rooms: RoomOption[];
  initialCode?: string;
}

const THUMB_INTERVAL_MS = 2000;

// Device cards in an auto-fill grid. Each: 16:9 live thumbnail, name,
// assigned room, status line. The last card pairs a new camera unit.
export function DeviceCards({ units, rooms, initialCode }: DeviceCardsProps) {
  const now = useClock();
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {units.map((unit) => (
        <DeviceCard key={unit.id} unit={unit} now={now} />
      ))}
      <PairCard rooms={rooms} initialCode={initialCode} />
    </div>
  );
}

function DeviceCard({ unit, now }: { unit: AdminUnit & { frameUrl: string }; now: number }) {
  const offline = isOffline(unit.last_seen, now);
  const frame = useLiveFrame(
    offline ? null : { url: unit.frameUrl, unitName: unit.name, lastSeen: unit.last_seen },
    false,
    THUMB_INTERVAL_MS
  );

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
      <div className="space-y-1 p-4">
        <div className="truncate text-[15px] font-medium">{unit.name}</div>
        <div className="truncate text-[13px] text-muted-foreground">
          {unit.room ? `${unit.room.building.name}, ${unit.room.name}` : "Not paired to a room"}
        </div>
        <div className={cn("text-[13px]", offline ? "text-state-full" : "text-muted-foreground")}>
          {offline
            ? unit.last_seen
              ? `Offline, ${durationText(unit.last_seen, now)}`
              : "Offline, never seen"
            : `Online, ${durationText(unit.last_seen, now)} ago`}
        </div>
      </div>
    </div>
  );
}

interface PairCardProps {
  rooms: RoomOption[];
  initialCode?: string;
  // On the setup page the room is fixed and the select is hidden.
  fixedRoomId?: string;
  onPaired?: (unit: { id: string; name: string }) => void;
}

export function PairCard({ rooms, initialCode = "", fixedRoomId, onPaired }: PairCardProps) {
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
    <form onSubmit={onSubmit} className="flex flex-col gap-3 bg-card p-4 text-card-foreground">
      <div>
        <div className="text-[15px] font-medium">Pair a camera unit</div>
        <p className="text-[13px] text-muted-foreground">Type the 6-digit code from its screen.</p>
      </div>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000 000"
        aria-label="Pair code"
        className="font-mono text-lg"
        required
      />
      {fixedRoomId ? null : (
        <div className="space-y-2">
          <Label htmlFor="pair-room">Room</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger id="pair-room" className="w-full">
              <SelectValue placeholder="Pick a room" />
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
