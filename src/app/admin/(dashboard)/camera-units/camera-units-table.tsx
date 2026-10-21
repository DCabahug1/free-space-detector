"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  assignCameraUnit,
  deleteCameraUnit,
  renameCameraUnit,
} from "@/app/admin/actions";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isStale, relativeTime } from "@/lib/occupancy";
import type { Room } from "@/lib/types";
import type { CameraUnitRow } from "./types";

const NONE = "__none__";

interface CameraUnitsTableProps {
  units: CameraUnitRow[];
  rooms: Pick<Room, "id" | "name">[];
}

export function CameraUnitsTable({ units, rooms }: CameraUnitsTableProps) {
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  // Which unit's rename dialog is open, if any.
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  function onAssign(unitId: string, value: string) {
    startTransition(async () => {
      const result = await assignCameraUnit(unitId, value === NONE ? null : value);
      if (result.error) toast.error(result.error);
      else toast.success("Camera unit updated.");
    });
  }

  function onRename(unitId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    startTransition(async () => {
      const result = await renameCameraUnit(unitId, name);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Camera unit renamed.");
      setRenamingId(null);
    });
  }

  function onDelete(unitId: string) {
    startTransition(async () => {
      const result = await deleteCameraUnit(unitId);
      if (result.error) toast.error(result.error);
      else toast.success("Camera unit removed.");
    });
  }

  if (units.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No camera units registered yet. A camera unit registers itself the
        first time it boots.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Camera unit</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Pair code</TableHead>
            <TableHead className="text-right">Last seen</TableHead>
            <TableHead className="w-20">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((unit) => {
            const online = !isStale(unit.last_seen, now);
            return (
              <TableRow key={unit.id}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1">
                    {unit.name}
                    <Dialog
                      open={renamingId === unit.id}
                      onOpenChange={(open) => setRenamingId(open ? unit.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Rename ${unit.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={(e) => onRename(unit.id, e)} className="space-y-6">
                          <DialogHeader>
                            <DialogTitle>Rename camera unit</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2">
                            <Label htmlFor={`rename-unit-${unit.id}`}>Name</Label>
                            <Input
                              id={`rename-unit-${unit.id}`}
                              name="name"
                              defaultValue={unit.name}
                              placeholder="Library corner cam"
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
                  </span>
                </TableCell>
                <TableCell>
                  <Select
                    value={unit.room_id ?? NONE}
                    onValueChange={(v) => onAssign(unit.id, v)}
                    disabled={pending}
                  >
                    <SelectTrigger size="sm" className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="font-mono tracking-widest">
                  {unit.pair_code ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(unit.last_seen, now)}
                    </span>
                    <Badge variant={online ? "default" : "outline"}>
                      {online ? "Online" : "Offline"}
                    </Badge>
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${unit.name}`}
                        disabled={pending}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {unit.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Its room assignment and pair code are forgotten. The
                          unit itself keeps running and registers again with a
                          new pair code the next time its script starts.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => onDelete(unit.id)}
                        >
                          Remove camera unit
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
