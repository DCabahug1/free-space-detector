"use client";

import { Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Pin toggle: outline when off, filled when on. Shared by building headers,
// area rows and zone tiles.
export function PinButton({
  pinned,
  name,
  onClick,
  className,
  pinnedClassName = "text-primary",
}: {
  pinned: boolean;
  name: string;
  onClick: () => void;
  // The ghost hover is the accent color, so on an accent surface pass a
  // hover class that contrasts with it.
  className?: string;
  // Glyph color while pinned.
  pinnedClassName?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("text-muted-foreground", className, pinned && pinnedClassName)}
      aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
      aria-pressed={pinned}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Pin className="size-4" fill={pinned ? "currentColor" : "none"} aria-hidden />
    </Button>
  );
}
