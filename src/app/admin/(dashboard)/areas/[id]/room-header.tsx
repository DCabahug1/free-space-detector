"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { deleteRoom, updateRoom } from "@/app/admin/actions";
import type { Building, PublicRoom } from "@/lib/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PublishSwitch } from "../../publish-switch";

interface RoomHeaderProps {
  room: PublicRoom;
  // Every building, for moving the area to another one.
  buildings: Building[];
  zoneCount: number;
  now: number;
}

export function RoomHeader({ room, buildings, zoneCount, now }: RoomHeaderProps) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [buildingId, setBuildingId] = useState(room.building_id);
  const [pending, startTransition] = useTransition();

  const unit = [...room.units].sort((a, b) =>
    (b.last_seen ?? "").localeCompare(a.last_seen ?? "")
  )[0];
  const offline = unit ? isOffline(unit.last_seen, now) : false;
  const unitStatus = !unit
    ? "No camera unit paired"
    : unit.paused
      ? `${unit.name}, sharing paused`
      : offline
      ? `${unit.name} offline, ${unit.last_seen ? durationText(unit.last_seen, now) : "never seen"}`
      : `${unit.name} online, ${durationText(unit.last_seen, now)} ago`;

  function onRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateRoom(room.id, {
        buildingId,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
      });
      if (result.error) {
        toast(result.error);
        return;
      }
      setRenameOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteRoom(room.id);
      if (result?.error) toast(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="break-words text-2xl font-semibold">
            <span className="font-normal text-muted-foreground">{room.building.name}, </span>
            {room.name}
          </h1>
          <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Rename area">
                <Pencil />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={onRename} className="space-y-6">
                <DialogHeader>
                  <DialogTitle>Building and area</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-building">Building</Label>
                    <Select value={buildingId} onValueChange={setBuildingId}>
                      <SelectTrigger id="edit-building" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Area</Label>
                    <Input id="edit-name" name="name" defaultValue={room.name} required autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Input
                      id="edit-description"
                      name="description"
                      defaultValue={room.description ?? ""}
                      maxLength={140}
                    />
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
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {room.description ? `${room.description}. ` : ""}
          <span className={cn(unit?.paused ? "text-state-shared" : offline && "text-state-full")}>{unitStatus}</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <PublishSwitch roomId={room.id} published={room.published} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className={deleteTriggerClass}>
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {room.building.name}, {room.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Its {zoneCount} {zoneCount === 1 ? "zone goes" : "zones go"} with it. The camera unit
                stays paired. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onDelete}>
                Delete area
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
