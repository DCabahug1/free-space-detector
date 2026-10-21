"use client";

import { useId, useState, useTransition } from "react";
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
import { cn } from "@/lib/utils";
import { Highlight } from "@/components/highlight";

// Building is free text with the existing names offered in a dropdown as the
// admin types. Picking one reuses that building, any other name makes a new one.
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
              <BuildingInput buildings={buildings} />
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

// Text input with an in-app suggestion list of existing buildings. Matches
// anywhere in the name, case-insensitive. Arrow keys move, Enter picks,
// Escape closes. Submits as the plain "building" field.
function BuildingInput({ buildings }: { buildings: Building[] }) {
  const listId = useId();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = value.trim().toLowerCase();
  const matches = q
    ? buildings.filter((b) => b.name.toLowerCase().includes(q) && b.name !== value)
    : [];
  const show = open && matches.length > 0;

  function pick(name: string) {
    setValue(name);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!show) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(matches[active].name);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id="room-building"
        name="building"
        placeholder="University Library"
        required
        autoFocus
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show ? `${listId}-${active}` : undefined}
      />
      {show ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Existing buildings"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {matches.map((b, i) => (
            <li
              key={b.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn("cursor-pointer px-3 py-2 text-sm", i === active && "bg-accent")}
              // Mouse down fires before the input's blur, so the pick lands.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(b.name);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <Highlight text={b.name} query={value} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
