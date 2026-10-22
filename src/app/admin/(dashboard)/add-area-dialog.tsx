"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

// "Add area" on a building header. The building is fixed; the dialog asks
// for the area's name and description, then opens its setup page.
export function AddAreaDialog({ building }: { building: Building }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createRoom({
        buildingId: building.id,
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
        <Button
          variant="ghost"
          size="sm"
          className="text-building-muted hover:bg-background dark:hover:bg-background"
          aria-label={`Add an area in ${building.name}`}
        >
          <Plus aria-hidden />
          Add area
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>New area in {building.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`area-name-${building.id}`}>Area</Label>
              <Input id={`area-name-${building.id}`} name="name" placeholder="Floor 2" required autoFocus maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`area-description-${building.id}`}>Description</Label>
              <Input
                id={`area-description-${building.id}`}
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
