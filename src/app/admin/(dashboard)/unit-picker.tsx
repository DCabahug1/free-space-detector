"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignCameraUnit, type UnitTransfer } from "@/app/admin/actions";
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
import { cn } from "@/lib/utils";
import type { AdminUnit } from "./admin-types";

interface TransferDialogProps {
  // Null keeps the dialog closed.
  transfer: UnitTransfer | null;
  // "{building}, {area}" the unit moves to.
  to: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// The second prompt before a unit leaves the area it is paired to.
export function TransferDialog({ transfer, to, pending, onConfirm, onCancel }: TransferDialogProps) {
  return (
    <AlertDialog open={transfer !== null} onOpenChange={(open) => (open ? null : onCancel())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move {transfer?.name} here?</AlertDialogTitle>
          <AlertDialogDescription>
            It is paired to {transfer?.from}. Moving it to {to} stops the counts there until another
            camera unit is paired.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            Move camera unit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface UnitPickerProps {
  units: AdminUnit[];
  room: { id: string; name: string; building: { name: string } };
  now: number;
  onAssigned: () => void;
}

// Every registered camera unit, whether paired or not, with a Use button.
// A unit paired to another area asks for the transfer confirmation first.
export function UnitPicker({ units, room, now, onAssigned }: UnitPickerProps) {
  const [transfer, setTransfer] = useState<UnitTransfer | null>(null);
  const [pending, startTransition] = useTransition();
  const to = `${room.building.name}, ${room.name}`;

  function assign(unitId: string, allowTransfer: boolean) {
    startTransition(async () => {
      const result = await assignCameraUnit(unitId, room.id, allowTransfer);
      if (result.error) {
        toast(result.error);
        return;
      }
      if (result.transfer) {
        setTransfer(result.transfer);
        return;
      }
      setTransfer(null);
      toast(`Paired ${result.unit?.name ?? "camera unit"}.`);
      onAssigned();
    });
  }

  if (units.length === 0) return null;

  const sorted = [...units].sort((a, b) => {
    // This area's units first, then unpaired, then the rest, each by name.
    const rank = (u: AdminUnit) => (u.room_id === room.id ? 0 : u.room_id ? 2 : 1);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground">
      <div>
        <div className="text-[15px] font-medium">Or pick an existing one</div>
        <p className="text-[13px] text-muted-foreground">
          {units.length} {units.length === 1 ? "camera unit" : "camera units"} registered.
        </p>
      </div>
      <ul className="divide-y border-y">
        {sorted.map((unit) => {
          const offline = isOffline(unit.last_seen, now);
          const here = unit.room_id === room.id;
          const elsewhere = unit.room_id !== null && !here;
          const status = unit.paused
            ? "Sharing paused"
            : offline
              ? unit.last_seen
                ? `Offline, ${durationText(unit.last_seen, now)}`
                : "Offline, never seen"
              : `Online, ${durationText(unit.last_seen, now)} ago`;
          const home = here
            ? "Paired here"
            : unit.room
              ? `Paired to ${unit.room.building.name}, ${unit.room.name}`
              : "Not paired";
          return (
            <li key={unit.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2">
              <div className="min-w-0">
                <div className="break-words text-[15px] font-medium">{unit.name}</div>
                <div className="break-words text-[13px] text-muted-foreground">{home}</div>
                <div
                  className={cn(
                    "text-[13px]",
                    unit.paused ? "text-state-shared" : offline ? "text-state-full" : "text-muted-foreground"
                  )}
                >
                  {status}
                </div>
              </div>
              {here ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => assign(unit.id, false)}
                >
                  {elsewhere ? "Move here" : "Use"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <TransferDialog
        transfer={transfer}
        to={to}
        pending={pending}
        onConfirm={() => transfer && assign(transfer.id, true)}
        onCancel={() => setTransfer(null)}
      />
    </div>
  );
}
