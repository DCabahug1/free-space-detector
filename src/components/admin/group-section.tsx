"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GroupSectionProps {
  title: string;
  caption: string;
  // Open on first render. Collapsed groups keep their header only.
  defaultOpen?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}

// A building group in the admin lists, styled like the public map: a
// header on the accent background with a chevron, rows beneath it.
export function GroupSection({ title, caption, defaultOpen = true, muted, children }: GroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="shadow-surface">
      <div className="flex items-center justify-between gap-3 bg-accent px-4 py-3">
        <div className="min-w-0">
          <h2 className={cn("truncate text-xl font-semibold", muted && "text-muted-foreground")}>{title}</h2>
          <p className="text-[13px] text-muted-foreground">{caption}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="hover:bg-background dark:hover:bg-background"
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        </Button>
      </div>
      {open ? <div className="divide-y border-b">{children}</div> : null}
    </section>
  );
}

// Search box and filter tabs sit together above a list.
export function ListFilters({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{children}</div>;
}
