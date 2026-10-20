"use client";

import { useRef, useState, useTransition } from "react";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { pairCameraUnit } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Room } from "@/lib/types";

interface PairFormProps {
  rooms: Pick<Room, "id" | "name">[];
}

export function PairForm({ rooms }: PairFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [roomId, setRoomId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("room_id", roomId);
    startTransition(async () => {
      const result = await pairCameraUnit(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Camera unit paired.");
      formRef.current?.reset();
    });
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4" aria-hidden />
          Pair a camera unit
        </CardTitle>
        <CardDescription>
          Type the 6-digit code shown on the camera unit&apos;s monitor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pair-code">Pair code</Label>
            <Input
              id="pair-code"
              name="pair_code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              className="font-mono text-lg tracking-[0.3em]"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pair-room">Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger id="pair-room" className="w-full">
                <SelectValue placeholder="Pick a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={pending || !roomId}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Pair
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
