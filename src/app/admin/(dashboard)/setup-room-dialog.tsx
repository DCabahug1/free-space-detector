"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRoom } from "@/app/admin/actions";
import type { Building } from "@/lib/types";
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

// Building is free text with the existing names as suggestions. A new name
// makes a new building.
export function SetupRoomDialog({ buildings }: { buildings: Building[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createRoom({
        building: String(form.get("building") ?? ""),
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
      });
      if (result.error) {
        toast(result.error);
        return;
      }
      setOpen(false);
      router.push(`/admin/areas/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Set up an area</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Set up an area</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room-building">Building</Label>
              <Input
                id="room-building"
                name="building"
                list="building-names"
                placeholder="University Library"
                required
                autoFocus
              />
              <datalist id="building-names">
                {buildings.map((b) => (
                  <option key={b.id} value={b.name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-name">Area</Label>
              <Input id="room-name" name="name" placeholder="Floor 2" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-description">Description</Label>
              <Input
                id="room-description"
                name="description"
                placeholder="East stairs, past the printers"
                maxLength={140}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating" : "Create area"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
