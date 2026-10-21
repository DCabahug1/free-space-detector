"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Highlight } from "@/components/highlight";

interface GroupSectionProps {
  title: string;
  caption: string;
  // Open on first render. Collapsed groups keep their header only.
  defaultOpen?: boolean;
  muted?: boolean;
  // Search text to highlight in the title.
  query?: string;
  children: React.ReactNode;
}

// A building group in the admin lists, styled like the public map: a
// header on the building background with a chevron, rows beneath it.
export function GroupSection({ title, caption, defaultOpen = true, muted, query = "", children }: GroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-lg border border-building-border bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-3 bg-building px-4 py-3 text-building-foreground">
        <div className="min-w-0">
          <h2 className={cn("truncate text-xl font-semibold tracking-[-0.01em]", muted && "text-building-muted")}>
            <Highlight text={title} query={query} />
          </h2>
          <p className="text-[13px] text-building-muted">{caption}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-building-muted hover:bg-background dark:hover:bg-background"
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        </Button>
      </div>
      {open ? <div className="divide-y border-t">{children}</div> : null}
    </section>
  );
}

// Search box and filter tabs sit together above a list.
export function ListFilters({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
