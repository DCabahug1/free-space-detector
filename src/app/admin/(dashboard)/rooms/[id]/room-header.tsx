"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteRoom, renameRoom } from "@/app/admin/actions";
import type { Room } from "@/lib/types";
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
import { PublishSwitch } from "../../publish-switch";

interface RoomHeaderProps {
  room: Room;
  zoneCount: number;
}

export function RoomHeader({ room, zoneCount }: RoomHeaderProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    startTransition(async () => {
      const result = await renameRoom(room.id, name);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setRenameOpen(false);
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteRoom(room.id);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All rooms
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-3xl font-semibold">{room.name}</h1>
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Rename room">
                  <Pencil className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={onRename} className="space-y-6">
                  <DialogHeader>
                    <DialogTitle>Rename room</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="rename-room">Name</Label>
                    <Input
                      id="rename-room"
                      name="name"
                      defaultValue={room.name}
                      required
                      autoFocus
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={pending}>
                      Save
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {zoneCount === 1 ? "1 zone" : `${zoneCount} zones`}
            {room.published ? (
              <Link
                href="/"
                target="_blank"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                View on public map
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PublishSwitch roomId={room.id} published={room.published} size="lg" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Delete room">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this room?</AlertDialogTitle>
                <AlertDialogDescription>
                  All of its zones and counts go with it. Camera units assigned
                  here become unassigned.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onDelete}>
                  Delete room
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
