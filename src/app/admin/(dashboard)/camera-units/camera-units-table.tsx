"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignCameraUnit } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((unit) => {
            const online = !isStale(unit.last_seen, now);
            return (
              <TableRow key={unit.id}>
                <TableCell className="font-medium">{unit.name}</TableCell>
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
